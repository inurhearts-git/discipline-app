import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

// Plain-language meanings for quotes and scripture (migration 0009).
// Server-only. Env: ANTHROPIC_API_KEY (required), MEANING_MODEL (optional).

export const MEANING_MODEL = process.env.MEANING_MODEL || "claude-sonnet-5-5";
export const MEANING_MAX_CHARS = 1200;

export interface MeaningSource {
  id: string;
  text: string;
  attributed_to: string | null;
  source: string | null;
  tag: string;
}

export function meaningConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

const SYSTEM = `You write short, plain-language explanations of quotes and scripture for a calm daily-reflection app.

For the passage you are given:
- Explain what it means in simple, modern English that a 14-year-old could follow.
- Keep it to 3 or 4 short sentences, at most 70 words.
- First say what it means, then one concrete way someone might apply it today.
- For scripture, give the reading most commonly understood across traditions. Be respectful and neutral. Do not preach, add doctrine, or take sides between faiths or denominations.
- Do not invent facts about the author or the source. If the meaning is genuinely unclear or disputed, say so briefly.
- Write only the explanation: no title, no quotation of the passage, no preamble, no lists, no emoji.`;

function userPrompt(item: MeaningSource): string {
  const kind = item.tag === "SCRIPTURE" ? "Scripture" : item.tag === "SPEECH" ? "From a speech" : "Quote";
  return `${kind}: "${item.text.trim()}"
Attributed to: ${item.attributed_to || "unknown"}${item.source ? `\nSource: ${item.source}` : ""}`;
}

// Asks Claude for a draft explanation. Throws with a short reason on failure.
export async function draftMeaningText(item: MeaningSource): Promise<string> {
  if (!meaningConfigured()) throw new Error("ANTHROPIC_API_KEY is not set");
  const client = new Anthropic();
  const msg = await client.messages.create({
    model: MEANING_MODEL,
    max_tokens: 400,
    system: SYSTEM,
    messages: [{ role: "user", content: userPrompt(item) }],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) throw new Error("empty reply");
  return text.slice(0, MEANING_MAX_CHARS);
}

// Drafts a meaning for one item and saves it as a draft, unless an approved
// meaning already exists (never overwritten automatically). Uses the
// service-role client; callers must have checked the user is an admin.
export async function draftAndStore(admin: SupabaseClient, item: MeaningSource, { overwriteApproved = false } = {}) {
  if (!overwriteApproved) {
    const { data: existing } = await admin.from("content_meanings").select("status").eq("content_id", item.id).maybeSingle<{ status: string }>();
    if (existing?.status === "approved") return { skipped: true as const };
  }
  const text = await draftMeaningText(item);
  const { error } = await admin.from("content_meanings").upsert(
    { content_id: item.id, text, status: "draft", source: "ai", model: MEANING_MODEL, updated_at: new Date().toISOString(), approved_by: null, approved_at: null },
    { onConflict: "content_id" }
  );
  if (error) throw new Error(error.message);
  return { skipped: false as const, text };
}

// Shared admin check for the meaning routes.
export async function requireAdmin(supabase: SupabaseClient): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
  return profile?.role === "admin" ? user.id : null;
}
