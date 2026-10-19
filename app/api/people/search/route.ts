import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { COST_PER_FRESH_SEARCH, SEARCH_COST, getUnitsUsed, recordUsage, searchesLeft } from "@/lib/youtube-quota";

interface YouTubeResult {
  videoId: string;
  title: string;
  channel: string;
  channelId: string;
  thumbnail: string;
  publishedAt: string;
}

const CACHE_TTL_HOURS = 24;

// Bump this when the search filters below change, so results cached under the
// old filters (which could include videos that can't play inside the app, or
// long videos) are ignored instead of being served for 24 hours.
const CACHE_VERSION = "v4";

// GET /api/people/search?q=David+Goggins
//
// The API key stays server-side (YOUTUBE_API_KEY, never NEXT_PUBLIC_-prefixed),
// and the frontend only ever talks to this route.
//
// Only creators/admins can search: this is a submission tool, and every fresh
// search costs real API quota (100 units of the 10,000 free per day). Results are cached for
// 24 hours, and cached searches cost nothing.
//
// Only videos under 4 minutes (YouTube's own "short" filter) that can be
// embedded are returned.
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role === "viewer") {
    return NextResponse.json({ error: "Only creators and admins can search" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  // ?status=1 only reports how many fresh searches are left today (free).
  if (searchParams.get("status")) {
    const used = await getUnitsUsed(createAdminClient());
    return NextResponse.json({ searchesLeft: used === null ? null : searchesLeft(used) });
  }

  if (!q) return NextResponse.json({ error: "Missing query" }, { status: 400 });

  const normalizedQuery = `${CACHE_VERSION}:${q.toLowerCase()}`;
  const admin = createAdminClient();

  // How many fresh searches are left today (null if the counter isn't set up).
  const leftNow = async () => {
    const used = await getUnitsUsed(admin);
    return used === null ? null : searchesLeft(used);
  };

  // "Cache search results (e.g. 24h) in Postgres so repeated searches for the
  // same person don't re-hit the API."
  const { data: cached } = await admin
    .from("youtube_search_cache")
    .select("results, fetched_at")
    .eq("query", normalizedQuery)
    .maybeSingle();

  if (cached) {
    const ageHours = (Date.now() - new Date(cached.fetched_at).getTime()) / (1000 * 60 * 60);
    if (ageHours < CACHE_TTL_HOURS) {
      return NextResponse.json({ results: cached.results as YouTubeResult[], cached: true, searchesLeft: await leftNow() });
    }
  }

  if (!process.env.YOUTUBE_API_KEY) {
    return NextResponse.json({ error: "YouTube search is not configured on the server yet." }, { status: 503 });
  }
  const key = process.env.YOUTUBE_API_KEY;

  // Our own tally: stop before YouTube does, so the page can say so plainly.
  const usedBefore = await getUnitsUsed(admin);
  if (usedBefore !== null && searchesLeft(usedBefore) <= 0) {
    return NextResponse.json(
      { error: "Today's YouTube search limit is used up. It resets at midnight Pacific time.", searchesLeft: 0 },
      { status: 429 }
    );
  }

  // "short" is YouTube's own filter for videos under 4 minutes.
  const searchParams2 = new URLSearchParams({
    part: "snippet",
    q: `${q} speech interview motivational`,
    type: "video",
    videoDuration: "short",
    // Only videos the owner allows to be embedded AND played on other sites.
    videoEmbeddable: "true",
    videoSyndicated: "true",
    safeSearch: "moderate",
    maxResults: "12",
    key,
  });

  const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams2}`);
  if (!ytRes.ok) {
    const detail = await ytRes.json().catch(() => null);
    return NextResponse.json(
      { error: detail?.error?.message || "YouTube search failed", searchesLeft: await leftNow() },
      { status: ytRes.status === 403 ? 429 : 502 }
    );
  }
  const data = await ytRes.json();

  const results: YouTubeResult[] = (data.items ?? [])
    .filter((item: any) => item.id?.videoId)
    .map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      channelId: item.snippet.channelId,
      thumbnail: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? "",
      publishedAt: item.snippet.publishedAt,
    }));

  // The search was billed, whatever it returns.
  await recordUsage(admin, SEARCH_COST, 1);

  await admin
    .from("youtube_search_cache")
    .upsert({ query: normalizedQuery, results, fetched_at: new Date().toISOString() }, { onConflict: "query" });

  return NextResponse.json({ results, cached: false, searchesLeft: await leftNow(), costPerSearch: COST_PER_FRESH_SEARCH });
}
