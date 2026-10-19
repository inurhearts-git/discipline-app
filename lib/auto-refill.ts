// Auto refill: reads the latest uploads of the channels switched on in
// /moderate/refill and adds suitable videos to the PENDING queue.
//
// Cost: 1 YouTube unit per channel (uploads playlist) plus 1 unit per 50 videos
// checked (length and embed status). A search costs 100, so this is cheap.

import type { SupabaseClient } from "@supabase/supabase-js";
import { DAILY_QUOTA_UNITS, getUnitsUsed, recordUsage } from "@/lib/youtube-quota";
import { blockedTerm } from "@/lib/content-filters";

export const MAX_PER_CHANNEL = 5; // new clips added per channel per run
export const FIRST_RUN_LOOKBACK = 5; // newest uploads considered the first time a channel runs
export const PENDING_CAP = 100; // stop adding while this many clips already wait for review
export const QUOTA_RESERVE = 1_000; // units kept free for admin searches
export const MIN_SECONDS = 15; // skips trailers and teasers
export const MAX_SECONDS = 239; // YouTube's own "short" is under 4 minutes

export interface RefillResult {
  channels: number;
  checked: number;
  added: number;
  skipped: { duplicate: number; length: number; notEmbeddable: number; live: number; blocked: number };
  errors: number;
  stopped: string | null; // why it stopped early, if it did
  unitsUsed: number;
}

interface PersonRow {
  id: string;
  name: string;
  youtube_channel_id: string | null;
  refill_since: string | null;
}

interface Upload {
  videoId: string;
  title: string;
  publishedAt: string;
  personId: string;
  personName: string;
}

function isoSeconds(iso: string | undefined): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso ?? "");
  if (!m) return 0;
  const [, d, h, min, s] = m;
  return (Number(d ?? 0) * 24 + Number(h ?? 0)) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0);
}

export async function runRefill(admin: SupabaseClient, apiKey: string): Promise<RefillResult> {
  const result: RefillResult = {
    channels: 0,
    checked: 0,
    added: 0,
    skipped: { duplicate: 0, length: 0, notEmbeddable: 0, live: 0, blocked: 0 },
    errors: 0,
    stopped: null,
    unitsUsed: 0,
  };
  let units = 0;
  const finish = async () => {
    result.unitsUsed = units;
    if (units > 0) await recordUsage(admin, units, 0);
    return result;
  };

  // 1) Safety checks before spending anything.
  const usedToday = await getUnitsUsed(admin);
  if (usedToday !== null && usedToday >= DAILY_QUOTA_UNITS - QUOTA_RESERVE) {
    result.stopped = "Not enough YouTube quota left today.";
    return result;
  }
  const { count: pendingCount } = await admin.from("content_items").select("id", { count: "exact", head: true }).eq("status", "pending");
  if ((pendingCount ?? 0) >= PENDING_CAP) {
    result.stopped = `${pendingCount} clips are already waiting for review. Clear some first.`;
    return result;
  }
  const { data: admins } = await admin.from("profiles").select("id").eq("role", "admin").order("created_at", { ascending: true }).limit(1);
  const submitter = admins?.[0]?.id as string | undefined;
  if (!submitter) {
    result.stopped = "No admin account found to file the clips under.";
    return result;
  }

  // 2) Channels switched on.
  const { data: people } = await admin
    .from("people")
    .select("id, name, youtube_channel_id, refill_since")
    .eq("auto_refill", true)
    .not("youtube_channel_id", "is", null)
    .returns<PersonRow[]>();
  const channels = (people ?? []).filter((p) => /^UC[\w-]{20,}$/.test(p.youtube_channel_id ?? ""));
  result.channels = channels.length;

  // 3) Latest uploads per channel (the uploads playlist id is the channel id with UC -> UU).
  const uploads: Upload[] = [];
  const newestSeen = new Map<string, string>(); // personId -> newest publishedAt looked at
  for (const p of channels) {
    const playlistId = `UU${(p.youtube_channel_id as string).slice(2)}`;
    const params = new URLSearchParams({ part: "snippet,contentDetails", playlistId, maxResults: "15", key: apiKey });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`);
    units += 1;
    if (!res.ok) {
      result.errors++;
      if (res.status === 403) {
        result.stopped = "YouTube refused the request (quota or key problem).";
        break;
      }
      continue;
    }
    const data = await res.json();
    const items: Upload[] = (data.items ?? [])
      .map((it: any) => ({
        videoId: it.contentDetails?.videoId as string,
        title: (it.snippet?.title as string) ?? "",
        publishedAt: (it.contentDetails?.videoPublishedAt ?? it.snippet?.publishedAt) as string,
        personId: p.id,
        personName: p.name,
      }))
      .filter((u: Upload) => u.videoId && u.publishedAt && u.title && u.title !== "Private video" && u.title !== "Deleted video")
      .sort((a: Upload, b: Upload) => b.publishedAt.localeCompare(a.publishedAt));
    if (items.length > 0) newestSeen.set(p.id, items[0].publishedAt);

    const fresh = p.refill_since ? items.filter((u) => u.publishedAt > (p.refill_since as string)) : items.slice(0, FIRST_RUN_LOOKBACK);
    uploads.push(...fresh);
  }

  // 4) Skip anything already in the app, whatever its status (this includes rejected clips).
  const ids = uploads.map((u) => u.videoId);
  const known = new Set<string>();
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await admin.from("content_items").select("video_id").in("video_id", ids.slice(i, i + 100));
    for (const r of data ?? []) known.add(r.video_id as string);
  }
  const candidates = uploads.filter((u) => {
    if (known.has(u.videoId)) {
      result.skipped.duplicate++;
      return false;
    }
    return true;
  });
  result.checked = candidates.length;

  // 5) Length, embed status and live status, 50 videos per call.
  const info = new Map<string, { sec: number; embeddable: boolean; isPublic: boolean; live: boolean; restricted: boolean }>();
  for (let i = 0; i < candidates.length; i += 50) {
    const batch = candidates.slice(i, i + 50);
    const params = new URLSearchParams({ part: "contentDetails,status,snippet", id: batch.map((b) => b.videoId).join(","), maxResults: "50", key: apiKey });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    units += 1;
    if (!res.ok) {
      result.errors++;
      continue;
    }
    const data = await res.json();
    for (const v of data.items ?? []) {
      info.set(v.id, {
        sec: isoSeconds(v.contentDetails?.duration),
        embeddable: v.status?.embeddable === true,
        isPublic: v.status?.privacyStatus === "public",
        live: (v.snippet?.liveBroadcastContent ?? "none") !== "none",
        // A clip blocked in some countries may not play for everyone.
        restricted: (v.contentDetails?.regionRestriction?.blocked?.length ?? 0) > 0 || v.contentDetails?.regionRestriction?.allowed !== undefined,
      });
    }
  }

  // 6) Filter, cap per channel, insert as pending.
  const perChannel = new Map<string, number>();
  const rows: Record<string, unknown>[] = [];
  for (const u of candidates) {
    const i = info.get(u.videoId);
    if (!i || !i.embeddable || !i.isPublic || i.restricted) {
      result.skipped.notEmbeddable++;
      continue;
    }
    if (i.live) {
      result.skipped.live++;
      continue;
    }
    if (i.sec < MIN_SECONDS || i.sec > MAX_SECONDS) {
      result.skipped.length++;
      continue;
    }
    if (blockedTerm(u.title)) {
      result.skipped.blocked++;
      continue;
    }
    const n = perChannel.get(u.personId) ?? 0;
    if (n >= MAX_PER_CHANNEL) continue;
    if ((pendingCount ?? 0) + rows.length >= PENDING_CAP) {
      result.stopped = "The review queue is full. The rest will be picked up another day.";
      break;
    }
    perChannel.set(u.personId, n + 1);
    rows.push({
      type: "video",
      tag: "SPEECH",
      text: u.title.slice(0, 300),
      attributed_to: u.personName,
      source: "YouTube",
      video_platform: "youtube",
      video_id: u.videoId,
      person_id: u.personId,
      maturity_rating: "general",
      moods: [],
      status: "pending",
      submitted_by: submitter,
      auto_added: true,
    });
  }
  if (rows.length > 0) {
    const { error } = await admin.from("content_items").insert(rows);
    if (error) {
      result.errors++;
      result.stopped = `Couldn't save the clips: ${error.message}`;
      return finish();
    }
    result.added = rows.length;
  }

  // 7) Remember where each channel got to, so the next run only looks at newer uploads.
  // If the run stopped early, channels keep their old position so nothing is lost.
  const nowIso = new Date().toISOString();
  for (const p of channels) {
    const newest = newestSeen.get(p.id);
    const patch: Record<string, unknown> = { refill_last_run_at: nowIso, refill_last_added: perChannel.get(p.id) ?? 0 };
    if (newest && !result.stopped) patch.refill_since = newest;
    await admin.from("people").update(patch).eq("id", p.id);
  }

  return finish();
}
