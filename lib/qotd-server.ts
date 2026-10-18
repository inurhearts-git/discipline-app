import type { SupabaseClient } from "@supabase/supabase-js";
import { pickQuoteOfTheDay } from "@/lib/qotd";
import { todayStr } from "@/lib/constants";
import type { ContentItem } from "@/lib/database.types";

export const QOTD_COLUMNS = "id, type, tag, text, attributed_to, source, video_platform, video_id, view_count, maturity_rating, person_id, audio_track_id, moods";

// Today's quote of the day: one approved, general-audience quote or scripture,
// the same for everyone, new each UTC day. Null when there is nothing to pick.
export async function getQuoteOfTheDay(supabase: SupabaseClient): Promise<ContentItem | null> {
  const { data: candidates } = await supabase
    .from("content_items")
    .select("id")
    .eq("status", "approved")
    .eq("maturity_rating", "general")
    .in("tag", ["QUOTE", "SCRIPTURE"])
    .limit(2000)
    .returns<{ id: string }[]>();
  const pick = pickQuoteOfTheDay((candidates ?? []).map((c) => c.id), todayStr());
  if (!pick) return null;
  const { data } = await supabase.from("content_items").select(QOTD_COLUMNS).eq("id", pick).maybeSingle<ContentItem>();
  return data ?? null;
}
