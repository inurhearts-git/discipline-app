// Journal export (backlog item 2). Turns a person's own entries into a plain
// text or Markdown file. Dates are written in the time zone the browser sends,
// so the file shows the same stamps the journal page shows.

import { countWords, wasEdited, type JournalEntry } from "@/lib/journal";

export type ExportFormat = "txt" | "md";
export type ExportOrder = "newest" | "oldest";

export const EXPORT_FORMATS: ExportFormat[] = ["txt", "md"];

// A valid IANA zone such as "Asia/Dubai", or UTC when missing or unknown.
export function safeTimeZone(tz: string | null): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

// "YYYY-MM-DD" or null.
export function parseDay(s: string | null): string | null {
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

// The calendar day of an instant in a time zone, as "YYYY-MM-DD".
export function localDay(iso: string, tz: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
}

// Same shape as fmtStamp in lib/journal.ts: "Sun 18 Oct 2026 · 11:46 pm".
export function stampIn(iso: string, tz: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", year: "numeric" }).replace(/^(\w+),/, "$1");
  const time = d.toLocaleTimeString("en-GB", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
  return `${date} · ${time}`;
}

export interface ExportOptions {
  format: ExportFormat;
  order: ExportOrder;
  tz: string;
  from: string | null; // inclusive local day
  to: string | null; // inclusive local day
  exportedAt?: Date;
}

// Keeps entries whose local day is within the range, sorted as asked.
export function selectEntries(entries: JournalEntry[], o: Pick<ExportOptions, "order" | "tz" | "from" | "to">): JournalEntry[] {
  const kept = entries.filter((e) => {
    const day = localDay(e.created_at, o.tz);
    if (o.from && day < o.from) return false;
    if (o.to && day > o.to) return false;
    return true;
  });
  kept.sort((a, b) => (o.order === "oldest" ? 1 : -1) * (Date.parse(a.created_at) - Date.parse(b.created_at)));
  return kept;
}

function rangeLine(from: string | null, to: string | null): string {
  if (from && to) return `Entries from ${from} to ${to}`;
  if (from) return `Entries from ${from} onwards`;
  if (to) return `Entries up to ${to}`;
  return "All entries";
}

export function renderExport(entries: JournalEntry[], o: ExportOptions): string {
  const exportedAt = stampIn((o.exportedAt ?? new Date()).toISOString(), o.tz);
  const count = `${entries.length} ${entries.length === 1 ? "entry" : "entries"}`;
  const meta = `${rangeLine(o.from, o.to)}, ${o.order} first. ${count}. Exported ${exportedAt} (${o.tz}).`;

  const info = (e: JournalEntry) => {
    const words = countWords(e.body);
    const edited = wasEdited(e) ? ` · edited ${stampIn(e.updated_at, o.tz)}` : "";
    return `${words} ${words === 1 ? "word" : "words"}${edited}`;
  };

  if (o.format === "md") {
    const parts = [`# My journal`, ``, `_${meta}_`, ``];
    if (!entries.length) parts.push("No entries in this range.", "");
    for (const e of entries) {
      parts.push(`---`, ``, `## ${stampIn(e.created_at, o.tz)}`, ``, `_${info(e)}_`, ``, mdBody(e.body), ``);
    }
    return parts.join("\n").replace(/\n+$/, "\n");
  }

  const rule = "=".repeat(48);
  const parts = ["MY JOURNAL", meta, ""];
  if (!entries.length) parts.push("No entries in this range.", "");
  for (const e of entries) {
    parts.push(rule, stampIn(e.created_at, o.tz), info(e), "", e.body, "");
  }
  return parts.join("\n").replace(/\n+$/, "\n");
}

// Keeps the writing as written: escape characters that Markdown would
// otherwise turn into headings, lists or rules at the start of a line, and
// keep single line breaks (two trailing spaces).
function mdBody(body: string): string {
  return body
    .split("\n")
    .map((line) => {
      let l = line.replace(/([\\`*_[\]<>])/g, "\\$1");
      l = l.replace(/^(\s*)(\d+)([.)]\s)/, "$1$2\\$3"); // "1. " -> "1\. "
      l = l.replace(/^(\s*)(#{1,6}\s|[-+]\s|---+\s*$|===+\s*$)/, "$1\\$2");
      return l;
    })
    .join("  \n")
    .replace(/ {2}\n {2}\n/g, "\n\n");
}

export function exportFileName(format: ExportFormat, tz: string, now = new Date()): string {
  return `journal-${localDay(now.toISOString(), tz)}.${format}`;
}
