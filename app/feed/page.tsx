import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DAILY_LIMIT_MS, isAdult, todayStr } from "@/lib/constants";
import { streakThroughYesterday } from "@/lib/streak";
import { isMoodId } from "@/lib/moods";
import { FeedClient, type MusicTrack } from "@/components/feed/FeedClient";
import type { ContentItem, Profile } from "@/lib/database.types";

const ITEM_COLUMNS = "id, type, tag, text, attributed_to, source, video_platform, video_id, view_count, maturity_rating, person_id, audio_track_id, moods";

// Share of the feed that matches the chosen mood. The rest comes from outside it,
// so the feed never runs dry and still gets a little variety.
const MOOD_SHARE = 0.7;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Ids this browser has recently viewed, oldest first (written by FeedClient).
function readSeenIds(): string[] {
  const raw = cookies().get("mf_seen")?.value;
  if (!raw) return [];
  try {
    return decodeURIComponent(raw).split(",").filter(Boolean);
  } catch {
    return [];
  }
}

// Keeps each list's order. Opens with a mood match if there is one, then
// picks from the mood list about MOOD_SHARE of the time.
function blendByMood<T>(matching: T[], others: T[]): T[] {
  const out: T[] = [];
  let a = 0;
  let b = 0;
  if (matching.length) out.push(matching[a++]);
  while (a < matching.length || b < others.length) {
    const takeMood = a < matching.length && (b >= others.length || Math.random() < MOOD_SHARE);
    out.push(takeMood ? matching[a++] : others[b++]);
  }
  return out;
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: { item?: string; tag?: string; mood?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile) redirect("/login");
  if (!profile.onboarded) redirect("/onboarding");

  const admin = createAdminClient();
  const { data: usage } = await admin
    .from("usage_sessions")
    .select("ms_spent")
    .eq("user_id", user.id)
    .eq("date", todayStr())
    .maybeSingle();

  const msSpentToday = usage?.ms_spent ?? 0;

  const { data: history } = await admin
    .from("usage_sessions")
    .select("date, ms_spent")
    .eq("user_id", user.id)
    .lt("date", todayStr())
    .order("date", { ascending: false })
    .limit(400);
  const streakBase = streakThroughYesterday(history ?? [], todayStr());
  if (msSpentToday >= DAILY_LIMIT_MS) redirect("/limit");

  const adult = isAdult(profile.birthdate);

  let itemsQuery = supabase
    .from("content_items")
    .select(ITEM_COLUMNS)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  // A topic picked from Explore overrides the saved interests for this visit.
  if (searchParams.tag) {
    itemsQuery = itemsQuery.eq("tag", searchParams.tag);
  } else if (profile.interests?.length) {
    itemsQuery = itemsQuery.in("tag", profile.interests);
  }

  if (!adult) {
    itemsQuery = itemsQuery.eq("maturity_rating", "general");
  }

  const { data } = await itemsQuery.returns<ContentItem[]>();
  let items = data ?? [];

  // Fresh order every visit: unseen items are shuffled, then items this browser
  // viewed recently follow, least recently seen first. Nothing is hidden.
  const seenIds = readSeenIds();
  const seenRank = new Map(seenIds.map((id, i) => [id, i]));
  const unseen = shuffle(items.filter((i) => !seenRank.has(i.id)));
  const seen = items
    .filter((i) => seenRank.has(i.id))
    .sort((x, y) => (seenRank.get(x.id) ?? 0) - (seenRank.get(y.id) ?? 0));
  items = [...unseen, ...seen];

  // Mood-first entry: the feed opens on a match and leans toward the mood
  // (about 70%), with the rest drawn from outside it.
  const mood = searchParams.mood && isMoodId(searchParams.mood) ? searchParams.mood : null;
  if (mood) {
    const hasMood = (i: ContentItem) => ((i as ContentItem & { moods?: string[] | null }).moods ?? []).includes(mood);
    items = blendByMood(items.filter(hasMood), items.filter((i) => !hasMood(i)));
  }

  // Opened from an Explore card: put that item first so the feed starts there.
  const startId = searchParams.item;
  if (startId) {
    const found = items.find((i) => i.id === startId);
    if (found) {
      items = [found, ...items.filter((i) => i.id !== startId)];
    } else {
      let one = supabase.from("content_items").select(ITEM_COLUMNS).eq("id", startId).eq("status", "approved");
      if (!adult) one = one.eq("maturity_rating", "general");
      const { data: extra } = await one.maybeSingle<ContentItem>();
      if (extra) items = [extra, ...items];
    }
  }

  const { data: interactions } = await supabase
    .from("user_content_interactions")
    .select("content_id, liked, saved")
    .eq("user_id", user.id);

  const liked: Record<string, boolean> = {};
  const saved: Record<string, boolean> = {};
  for (const row of interactions ?? []) {
    liked[row.content_id] = row.liked;
    saved[row.content_id] = row.saved;
  }

  // Music library (empty until migration 0004 is run and tracks are added)
  const { data: trackRows } = await supabase
    .from("music_tracks")
    .select("id, title, artist, audio_url, mood_tags")
    .eq("is_active", true);

  return (
    <FeedClient
      items={items}
      profile={profile}
      initialLiked={liked}
      initialSaved={saved}
      initialMsSpentToday={msSpentToday}
      streakBase={streakBase}
      activeMood={mood}
      tracks={(trackRows ?? []) as MusicTrack[]}
    />
  );
}
