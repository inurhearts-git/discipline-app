import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, PenLine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/ui/Shell";
import { COLORS } from "@/lib/constants";

interface ReflectionRow {
  date: string;
  text: string;
  content_id: string | null;
}

interface QuoteRow {
  id: string;
  text: string;
  attributed_to: string;
}

// "Sun 18 Oct 2026" from a YYYY-MM-DD day (UTC, like every day in the app).
function fmtDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

// Private journal: every one-line reflection, newest first, with the quote it was about.
export default async function JournalPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("reflections")
    .select("date, text, content_id")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(366)
    .returns<ReflectionRow[]>();
  const rows = error ? [] : data ?? [];

  const quoteIds = Array.from(new Set(rows.map((r) => r.content_id).filter((id): id is string => !!id)));
  const quotes = new Map<string, QuoteRow>();
  if (quoteIds.length) {
    const { data: q } = await supabase.from("content_items").select("id, text, attributed_to").in("id", quoteIds).returns<QuoteRow[]>();
    for (const row of q ?? []) quotes.set(row.id, row);
  }

  return (
    <Shell>
      <div style={{ padding: "18px 22px 28px", minHeight: 720 }}>
        <Link href="/profile" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: COLORS.slate, fontSize: 13, textDecoration: "none" }}>
          <ArrowLeft size={16} /> Profile
        </Link>
        <h1 style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontWeight: 400, fontSize: 26, color: COLORS.parchment, margin: "18px 0 4px" }}>Reflections</h1>
        <p style={{ fontSize: 12, color: COLORS.slate, margin: "0 0 22px" }}>
          {rows.length ? `${rows.length} ${rows.length === 1 ? "day" : "days"} written. Only you can see these.` : "Only you can see these."}
        </p>

        {rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 12px", color: COLORS.slate, fontSize: 13, lineHeight: 1.7 }}>
            <PenLine size={22} color={COLORS.brass} style={{ marginBottom: 10 }} />
            <p style={{ margin: 0 }}>
              Nothing yet. Write one line under the{" "}
              <Link href="/today" style={{ color: COLORS.brass, textDecoration: "none" }}>
                quote of the day
              </Link>
              , or when your hour is up.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {rows.map((r) => {
              const q = r.content_id ? quotes.get(r.content_id) : undefined;
              return (
                <div key={r.date} style={{ borderLeft: `2px solid ${COLORS.brass}`, paddingLeft: 14 }}>
                  <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: COLORS.slate, marginBottom: 6 }}>{fmtDay(r.date)}</div>
                  <p style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 17, lineHeight: 1.45, color: COLORS.parchment, margin: 0 }}>{r.text}</p>
                  {q && (
                    <Link
                      href={`/feed?item=${q.id}`}
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        marginTop: 8,
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: COLORS.slate,
                        textDecoration: "none",
                      }}
                    >
                      On “{q.text}” · {q.attributed_to}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Shell>
  );
}
