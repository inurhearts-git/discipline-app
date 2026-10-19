// Tracks YouTube Data API quota in our own table, because YouTube can't tell us
// how much is left. Needs migration 0010; if the table isn't there yet, every
// function here quietly does nothing and the page just hides the counter.

import type { SupabaseClient } from "@supabase/supabase-js";

export const DAILY_QUOTA_UNITS = 10_000;
export const SEARCH_COST = 100; // search.list
export const LOOKUP_COST = 1; // videos.list (up to 50 ids per call)
// A fresh search is one search plus one lookup of its results.
export const COST_PER_FRESH_SEARCH = SEARCH_COST + LOOKUP_COST;

// YouTube's quota day rolls over at midnight Pacific time.
export function quotaDay(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(now);
}

export function searchesLeft(unitsUsed: number): number {
  return Math.max(0, Math.floor((DAILY_QUOTA_UNITS - unitsUsed) / COST_PER_FRESH_SEARCH));
}

// Units used today, or null if the table isn't available.
export async function getUnitsUsed(admin: SupabaseClient): Promise<number | null> {
  try {
    const { data, error } = await admin.from("youtube_quota_usage").select("units").eq("day", quotaDay()).maybeSingle();
    if (error) return null;
    return (data as { units: number } | null)?.units ?? 0;
  } catch {
    return null;
  }
}

// Adds units (and optionally searches) to today's tally. Never throws.
export async function recordUsage(admin: SupabaseClient, units: number, searches: number): Promise<void> {
  try {
    const day = quotaDay();
    const { data, error } = await admin.from("youtube_quota_usage").select("units, searches").eq("day", day).maybeSingle();
    if (error) return;
    const row = data as { units: number; searches: number } | null;
    await admin.from("youtube_quota_usage").upsert(
      {
        day,
        units: (row?.units ?? 0) + units,
        searches: (row?.searches ?? 0) + searches,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "day" }
    );
  } catch {
    /* counting is best-effort */
  }
}

// ISO 8601 duration from YouTube ("PT1M30S", "PT45S", "PT1H2M") to seconds.
export function parseIsoDuration(iso: string | undefined): number {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso ?? "");
  if (!m) return 0;
  const [, d, h, min, s] = m;
  return (Number(d ?? 0) * 24 + Number(h ?? 0)) * 3600 + Number(min ?? 0) * 60 + Number(s ?? 0);
}

// The clip length the app accepts.
export const MIN_CLIP_SECONDS = 30;
export const MAX_CLIP_SECONDS = 120;
