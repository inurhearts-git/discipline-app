import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMoodId } from "@/lib/moods";
import { deletedAccountResponse, isDeletedAccount } from "@/lib/api-auth";

const MAX_BATCH = 50;
const MAX_CAPTION = 300;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

// POST /api/admin/bulk-add
//   { speaker: string,
//     channel_id?: string,
//     maturity_rating?: "general" | "mature",
//     moods?: string[],
//     items: { video_id: string, text: string }[] }
//
// Admin-only. Adds many speech clips in one go, already approved, so an admin
// can fill the feed without going through the submit -> moderate loop one clip
// at a time. The caller's role is checked server-side (same pattern as
// /api/moderate/[id]); the insert then uses the service-role client.
// Videos already in content_items (same video_id) are skipped, not duplicated.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isDeletedAccount(user)) return deletedAccountResponse();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  const speaker = typeof body.speaker === "string" ? body.speaker.trim() : "";
  if (!speaker) return NextResponse.json({ error: "Add the speaker's name." }, { status: 400 });

  const rawItems: unknown[] = Array.isArray(body.items) ? body.items : [];
  if (rawItems.length === 0) return NextResponse.json({ error: "No videos selected." }, { status: 400 });
  if (rawItems.length > MAX_BATCH) {
    return NextResponse.json({ error: `Add at most ${MAX_BATCH} videos at a time.` }, { status: 400 });
  }

  // Validate and de-duplicate the submitted videos.
  const seenInBatch = new Set<string>();
  const clips: { video_id: string; text: string }[] = [];
  for (const raw of rawItems) {
    const it = raw as { video_id?: unknown; text?: unknown };
    const videoId = typeof it.video_id === "string" ? it.video_id.trim() : "";
    const text = typeof it.text === "string" ? it.text.trim().slice(0, MAX_CAPTION) : "";
    if (!VIDEO_ID.test(videoId)) {
      return NextResponse.json({ error: `"${videoId}" is not a valid YouTube video ID.` }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ error: "Every video needs a caption." }, { status: 400 });
    }
    if (seenInBatch.has(videoId)) continue;
    seenInBatch.add(videoId);
    clips.push({ video_id: videoId, text });
  }

  const maturity = body.maturity_rating === "mature" ? "mature" : "general";
  const moods: string[] = Array.isArray(body.moods)
    ? Array.from(new Set(body.moods.filter((m: unknown): m is string => typeof m === "string" && isMoodId(m))))
    : [];
  const channelId = typeof body.channel_id === "string" && body.channel_id.trim() ? body.channel_id.trim() : null;

  const admin = createAdminClient();

  // Skip anything already in the feed (any status).
  const { data: existing, error: existingError } = await admin
    .from("content_items")
    .select("video_id")
    .in(
      "video_id",
      clips.map((c) => c.video_id)
    );
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
  const alreadyIn = new Set((existing ?? []).map((r: { video_id: string | null }) => r.video_id));
  const fresh = clips.filter((c) => !alreadyIn.has(c.video_id));

  if (fresh.length === 0) {
    return NextResponse.json({ added: 0, skipped: clips.length });
  }

  // Find or create the person record for this speaker.
  let personId: string | null = null;
  const { data: found } = await admin.from("people").select("id").ilike("name", speaker).limit(1);
  if (found && found.length > 0) {
    personId = found[0].id;
  } else {
    const { data: created, error: personError } = await admin
      .from("people")
      .insert({ name: speaker, youtube_channel_id: channelId })
      .select("id")
      .single();
    if (personError) {
      return NextResponse.json({ error: `Couldn't save the person record: ${personError.message}` }, { status: 500 });
    }
    personId = created.id;
  }

  const rows: Record<string, unknown>[] = fresh.map((c) => ({
    type: "video",
    tag: "SPEECH",
    text: c.text,
    attributed_to: speaker,
    source: "YouTube",
    video_platform: "youtube",
    video_id: c.video_id,
    person_id: personId,
    maturity_rating: maturity,
    moods,
    status: "approved",
    submitted_by: user.id,
    reviewed_by: user.id,
  }));

  const { error: insertError } = await admin.from("content_items").insert(rows);
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ added: fresh.length, skipped: clips.length - fresh.length });
}
