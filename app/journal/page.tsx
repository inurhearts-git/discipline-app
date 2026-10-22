import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, NotebookPen, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/ui/Shell";
import { Stamp } from "@/components/journal/Stamp";
import { ExportJournal } from "@/components/journal/ExportJournal";
import { COLORS } from "@/lib/constants";
import { countWords, wasEdited, type JournalEntry } from "@/lib/journal";

// Private journal: every entry, newest first, with its date and time stamp.
export default async function JournalPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("journal_entries")
    .select("id, body, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(300)
    .returns<JournalEntry[]>();
  const entries = error ? [] : data ?? [];
  const notSetUp = !!error;

  return (
    <Shell>
      <div style={{ padding: "18px 22px 28px", minHeight: 720 }}>
        <Link href="/profile" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: COLORS.slate, fontSize: 13, textDecoration: "none" }}>
          <ArrowLeft size={16} /> Profile
        </Link>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", margin: "18px 0 22px" }}>
          <div>
            <h1 style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontWeight: 400, fontSize: 26, color: COLORS.parchment, margin: "0 0 4px" }}>Journal</h1>
            <p style={{ fontSize: 12, color: COLORS.slate, margin: 0 }}>
              {entries.length ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"}. ` : ""}Only you can see these.
            </p>
          </div>
          <Link
            href="/journal/new"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 10, background: COLORS.brass, color: COLORS.onBrass, fontSize: 13, fontWeight: 600, textDecoration: "none" }}
          >
            <Plus size={16} /> New entry
          </Link>
        </div>

        {!notSetUp && entries.length > 0 && (
          <div style={{ marginTop: -8, marginBottom: 14 }}>
            <ExportJournal />
          </div>
        )}

        {notSetUp ? (
          <p style={{ fontSize: 13, color: COLORS.slate, textAlign: "center", padding: "60px 12px" }}>The journal isn&apos;t set up yet (run migration 0008).</p>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 12px", color: COLORS.slate, fontSize: 13, lineHeight: 1.7 }}>
            <NotebookPen size={24} color={COLORS.brass} style={{ marginBottom: 10 }} />
            <p style={{ margin: 0 }}>No entries yet. Write about your day, a thought you want to keep, or what a quote stirred in you. Up to 1,000 words each.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {entries.map((e) => (
              <Link key={e.id} href={`/journal/${e.id}`} style={{ display: "block", border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "14px 16px", textDecoration: "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11, letterSpacing: 0.6, color: COLORS.slate, marginBottom: 8 }}>
                  <span style={{ textTransform: "uppercase" }}>
                    <Stamp iso={e.created_at} />
                  </span>
                  <span style={{ flexShrink: 0 }}>
                    {countWords(e.body)} words{wasEdited(e) ? " · edited" : ""}
                  </span>
                </div>
                <p
                  style={{
                    fontFamily: "'Newsreader', serif",
                    fontSize: 16,
                    lineHeight: 1.5,
                    color: COLORS.parchment,
                    margin: 0,
                    whiteSpace: "pre-line",
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {e.body}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Shell>
  );
}
