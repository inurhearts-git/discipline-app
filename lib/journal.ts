// Private journal (migration 0008). Shared by the API and the pages.

export const JOURNAL_MAX_WORDS = 1000;
export const JOURNAL_MAX_CHARS = 12000; // backstop, matches the database check

export interface JournalEntry {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export function countWords(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

// Trims the ends, normalises line endings and squeezes long runs of blank lines.
export function cleanBody(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}

// Returns an error message, or null when the entry is fine to save.
export function checkBody(body: string): string | null {
  if (!body) return "Write something first.";
  const words = countWords(body);
  if (words > JOURNAL_MAX_WORDS) return `That's ${words} words. Entries can be up to ${JOURNAL_MAX_WORDS}.`;
  if (body.length > JOURNAL_MAX_CHARS) return "That entry is too long.";
  return null;
}

// "Sun 18 Oct 2026 · 11:46 pm" in the viewer's own time zone.
// Call only in the browser (after mount), so the server's UTC clock never shows.
export function fmtStamp(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
  return `${date} · ${time}`;
}

// An entry counts as edited if it changed more than a minute after it was written.
export function wasEdited(e: Pick<JournalEntry, "created_at" | "updated_at">): boolean {
  return Date.parse(e.updated_at) - Date.parse(e.created_at) > 60_000;
}
