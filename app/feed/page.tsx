import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DAILY_LIMIT_MS, isAdult, todayStr } from "@/lib/constants";
import { streakThroughYesterday } from "@/lib/streak";
import { isMoodId } from "@/lib/moods";
import { pickQuoteOfTheDay } from "@/lib/qotd";
import { FeedClient, type MusicTrack } from "@/components/feed/FeedClient";
import type { ContentItem, Profile } from "@/lib/database.types";

const ITEM_COLUMNS = "id, type, tag, text, attributed_to, source, video_platform, video_id, view_count, maturity_rating, person_id, audio_track_id, moods";

// Share of the feed that matches the chosen mood. The rest comes from outside it,
// so the feed never runs dry and still gets a little variety.
const MOOD_SHARE = 0.7;

// ---- Learning from likes and saves ----
// Until someone has liked or saved this many items, the order stays a plain shuffle.
const MIN_SIGNALS = 3;
// The best-matching items are up to (1 + MAX_BOOST) times more likely to land early.
const MAX_BOOST = 3;

interface TasteRow {
  id: string;
  tag: string | null;
  moods: string[] | null;
  attributed_to: string | null;
}

interface Taste {
  total: number;
  moods: Map<string, number>;
  tags: Map<string, number>;
  speakers: Map<string, number>;
}

function bump(map: Map<string, number>, key: string | null | undefined, by: number) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + by);
}

// A like counts 1 and a save counts 2 (both = 3), so saves steer harder.
function buildTaste(rows: TasteRow[], weightOf: Map<string, number>): Taste {
  const taste: Taste = { total: 0, moods: new Map(), tags: new Map(), speakers: new Map() };
  for (const r of rows) {
    const w = weightOf.get(r.id) ?? 0;
    if (w <= 0) continue;
    taste.total += w;
    for (const m of new Set(r.moods ?? [])) bump(taste.moods, m, w);
    bump(taste.tags, r.tag, w);
    bump(taste.speakers, r.attributed_to, w);
  }
  return taste;
}

// 1 = no preference. Rises toward 1 + MAX_BOOST as an item's moods, topic and
// speaker match more of what the person has liked or saved.
function tasteWeight(item: ContentItem & { moods?: string[] | null }, taste: Taste): number {
  if (taste.total === 0) return 1;
  let moodShare = 0;
  for (const m of item.moods ?? []) moodShare = Math.max(moodShare, (taste.moods.get(m) ?? 0) / taste.total);
  const tagShare = (taste.tags.get(item.tag) ?? 0) / taste.total;
  const speakerShare = (taste.speakers.get(item.attributed_to) ?? 0) / taste.total;
  return 1 + MAX_BOOST * (0.4 * moodShare + 0.3 * tagShare + 0.3 * speakerShare);
}

// Weighted random order (Efraimidis-Spirakis): heavier items tend to come
// first, but every item can still land anywhere. With equal weights this is a
// plain uniform shuffle.
function weightedShuffle<T>(arr: T[], weightOf: (x: T) => number): T[] {
  return arr
    .map((x) => ({ x, key: Math.random() ** (1 / Math.max(weightOf(x), 0.0001)) }))
    .sort((a, b) => b.key - a.key)
    .map((e) => e.x);
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

  // What this person has liked or saved (up to 200 signals), turned into a taste profile.
  const signalWeight = new Map<string, number>();
  for (const row of interactions ?? []) {
    const w = (row.liked ? 1 : 0) + (row.saved ? 2 : 0);
    if (w > 0) signalWeight.set(row.content_id, w);
  }
  let taste: Taste = { total: 0, moods: new Map(), tags: new Map(), speakers: new Map() };
  if (signalWeight.size >= MIN_SIGNALS) {
    const signalIds = Array.from(signalWeight.keys()).slice(0, 200);
    const { data: signalRows } = await supabase
      .from("content_items")
      .select("id, tag, moods, attributed_to")
      .in("id", signalIds)
      .returns<TasteRow[]>();
    taste = buildTaste(signalRows ?? [], signalWeight);
  }

  // Fresh order every visit: unseen items are shuffled (leaning toward what the
  // person has liked or saved), then items this browser viewed recently follow,
  // least recently seen first. Nothing is hidden. Items they already liked or
  // saved get no boost, so the boost goes to new things that feel similar.
  const seenIds = readSeenIds();
  const seenRank = new Map(seenIds.map((id, i) => [id, i]));
  const unseen = weightedShuffle(
    items.filter((i) => !seenRank.has(i.id)),
    (i) => (liked[i.id] || saved[i.id] ? 1 : tasteWeight(i, taste))
  );
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

  // Quote of the day: the same quote or scripture for everyone, new each day.
  // Until it has been shown on this browser today (mf_qotd cookie, set by the
  // feed when the tile is on screen), it leads the feed. If the visit came from
  // a mood pick (which happens on the first open of each day), it goes second so
  // the mood match still opens the feed. Skipped for an Explore card or a topic.
  let featuredId: string | null = null;
  {
    const { data: candidates } = await supabase
      .from("content_items")
      .select("id")
      .eq("status", "approved")
      .eq("maturity_rating", "general")
      .in("tag", ["QUOTE", "SCRIPTURE"])
      .limit(2000)
      .returns<{ id: string }[]>();
    const pick = pickQuoteOfTheDay((candidates ?? []).map((c) => c.id), todayStr());
    if (pick) {
      featuredId = pick;
      const steered = !!(searchParams.item || searchParams.tag);
      if (!steered && cookies().get("mf_qotd")?.value !== todayStr()) {
        let found = items.find((i) => i.id === pick);
        if (!found) {
          const { data: one } = await supabase.from("content_items").select(ITEM_COLUMNS).eq("id", pick).maybeSingle<ContentItem>();
          found = one ?? undefined;
        }
        if (found) {
          const rest = items.filter((i) => i.id !== pick);
          const at = mood && rest.length > 0 ? 1 : 0;
          items = [...rest.slice(0, at), found, ...rest.slice(at)];
        }
      }
    }
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
      featuredId={featuredId}
      tracks={(trackRows ?? []) as MusicTrack[]}
    />
  );
}
