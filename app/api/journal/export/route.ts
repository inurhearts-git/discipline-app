import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { JournalEntry } from "@/lib/journal";
import { EXPORT_FORMATS, exportFileName, parseDay, renderExport, safeTimeZone, selectEntries, type ExportFormat } from "@/lib/journal-export";
import { deletedAccountResponse, isDeletedAccount } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const PAGE = 1000;
const MAX_ENTRIES = 20000; // far above any real journal; stops a runaway loop

// GET /api/journal/export?format=txt|md&order=newest|oldest&from=YYYY-MM-DD&to=YYYY-MM-DD&tz=Asia/Dubai
// Downloads the signed-in person's own journal entries. Only their rows are
// read (filtered by user_id and enforced by RLS, migration 0008).
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isDeletedAccount(user)) return deletedAccountResponse();

  const url = new URL(request.url);
  const format = (url.searchParams.get("format") ?? "txt") as ExportFormat;
  if (!EXPORT_FORMATS.includes(format)) return NextResponse.json({ error: "Format must be txt or md." }, { status: 400 });
  const order = url.searchParams.get("order") === "oldest" ? "oldest" : "newest";
  const tz = safeTimeZone(url.searchParams.get("tz"));
  let from = parseDay(url.searchParams.get("from"));
  let to = parseDay(url.searchParams.get("to"));
  if (from && to && from > to) [from, to] = [to, from];

  const all: JournalEntry[] = [];
  for (let start = 0; start < MAX_ENTRIES; start += PAGE) {
    const { data, error } = await supabase
      .from("journal_entries")
      .select("id, body, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(start, start + PAGE - 1)
      .returns<JournalEntry[]>();
    if (error) return NextResponse.json({ error: "Couldn't read your journal. Try again." }, { status: 500 });
    all.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }

  const entries = selectEntries(all, { order, tz, from, to });
  const text = renderExport(entries, { format, order, tz, from, to });
  const name = exportFileName(format, tz);

  return new NextResponse(text, {
    headers: {
      "Content-Type": `${format === "md" ? "text/markdown" : "text/plain"}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
