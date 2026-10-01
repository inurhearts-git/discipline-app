import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

interface YouTubeResult {
  videoId: string;
  title: string;
  channel: string;
  channelId: string;
  thumbnail: string;
  publishedAt: string;
}

const CACHE_TTL_HOURS = 24;

// GET /api/people/search?q=David+Goggins
//
// This is the piece the artifact prototype could never do: the API key
// stays server-side (YOUTUBE_API_KEY, never NEXT_PUBLIC_-prefixed, never
// shipped to the browser), and the frontend only ever talks to this route.
//
// Only creators/admins can search -- this is a submission tool, not a
// general feed feature, and every search costs real API quota.
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
  if (!q) return NextResponse.json({ error: "Missing query" }, { status: 400 });

  const normalizedQuery = q.toLowerCase();
  const admin = createAdminClient();

  // Blueprint §4: "Cache search results (e.g. 24h) in Postgres so repeated
  // searches for the same person don't re-hit the API."
  const { data: cached } = await admin
    .from("youtube_search_cache")
    .select("results, fetched_at")
    .eq("query", normalizedQuery)
    .maybeSingle();

  if (cached) {
    const ageHours = (Date.now() - new Date(cached.fetched_at).getTime()) / (1000 * 60 * 60);
    if (ageHours < CACHE_TTL_HOURS) {
      return NextResponse.json({ results: cached.results as YouTubeResult[], cached: true });
    }
  }

  if (!process.env.YOUTUBE_API_KEY) {
    return NextResponse.json({ error: "YouTube search is not configured on the server yet." }, { status: 503 });
  }

  const params = new URLSearchParams({
    part: "snippet",
    q: `${q} speech interview motivational`,
    type: "video",
    maxResults: "12",
    key: process.env.YOUTUBE_API_KEY,
  });

  const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!ytRes.ok) {
    const detail = await ytRes.json().catch(() => null);
    return NextResponse.json(
      { error: detail?.error?.message || "YouTube search failed" },
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

  await admin
    .from("youtube_search_cache")
    .upsert({ query: normalizedQuery, results, fetched_at: new Date().toISOString() }, { onConflict: "query" });

  return NextResponse.json({ results, cached: false });
}