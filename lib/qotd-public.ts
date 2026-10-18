import { createAdminClient } from "@/lib/supabase/admin";
import { pickQuoteOfTheDay } from "@/lib/qotd";
import { todayStr } from "@/lib/constants";

export interface PublicQuote {
  text: string;
  by: string;
  source: string | null;
}

// Today's quote of the day for the signed-out screens (login, sign-up,
// password reset). Visitors have no session, so RLS would hide content from
// them; this uses the server-only admin client but reads just the public text
// of approved, general-audience quotes and scripture, the same pool and pick
// as /today. Returns null on any failure so the page can fall back.
export async function getPublicQuoteOfTheDay(): Promise<PublicQuote | null> {
  try {
    const admin = createAdminClient();
    const { data: candidates, error } = await admin
      .from("content_items")
      .select("id")
      .eq("status", "approved")
      .eq("maturity_rating", "general")
      .in("tag", ["QUOTE", "SCRIPTURE"])
      .limit(2000)
      .returns<{ id: string }[]>();
    if (error) return null;
    const pick = pickQuoteOfTheDay((candidates ?? []).map((c) => c.id), todayStr());
    if (!pick) return null;
    const { data } = await admin
      .from("content_items")
      .select("text, attributed_to, source")
      .eq("id", pick)
      .maybeSingle<{ text: string; attributed_to: string; source: string | null }>();
    if (!data?.text) return null;
    return { text: data.text.trim(), by: data.attributed_to, source: data.source };
  } catch {
    return null;
  }
}
