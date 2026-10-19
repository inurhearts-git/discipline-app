import { MOODS } from "@/lib/moods";

export interface Collection {
  id: string;
  title: string;
  blurb: string;
  emoji: string;
  tags: string[];
  moods: string[];
  sort_order: number;
  is_active: boolean;
}

export const COLLECTION_TAGS = ["QUOTE", "SCRIPTURE", "SPEECH"] as const;
const MOOD_IDS: string[] = MOODS.map((m) => m.id);

export const COLLECTION_COLUMNS = "id, title, blurb, emoji, tags, moods, sort_order, is_active";

// Cleans and checks what the admin form sent. Returns an error message or the values.
export function parseCollectionInput(body: any): { error: string } | { value: Omit<Collection, "id"> } {
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const blurb = typeof body?.blurb === "string" ? body.blurb.trim() : "";
  const emoji = typeof body?.emoji === "string" && body.emoji.trim() ? body.emoji.trim() : "📚";
  if (!title || title.length > 60) return { error: "Give it a title of up to 60 characters." };
  if (blurb.length > 160) return { error: "Keep the blurb to 160 characters." };
  if (emoji.length > 8) return { error: "Use a single emoji." };
  const tags = Array.isArray(body?.tags) ? body.tags.filter((t: unknown): t is string => typeof t === "string" && (COLLECTION_TAGS as readonly string[]).includes(t)) : [];
  const moods = Array.isArray(body?.moods) ? body.moods.filter((m: unknown): m is string => typeof m === "string" && MOOD_IDS.includes(m)) : [];
  if (tags.length === 0 && moods.length === 0) return { error: "Pick at least one topic or mood, or the collection would hold everything." };
  const sort = Number.isFinite(Number(body?.sort_order)) ? Math.trunc(Number(body.sort_order)) : 0;
  return { value: { title, blurb, emoji, tags, moods, sort_order: sort, is_active: body?.is_active !== false } };
}
