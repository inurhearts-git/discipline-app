import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { COLORS, isAdult, tagColor } from "@/lib/constants";
import { Shell, Logo } from "@/components/ui/Shell";
import { ContentCard, type CardItem } from "@/components/explore/ContentCard";

type Row = CardItem & { person_id: string | null };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <h2 style={{ fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", color: COLORS.slate, margin: "0 20px 12px", fontWeight: 500 }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

const rowStyle = { display: "flex", gap: 12, overflowX: "auto" as const, padding: "0 20px" };

export default async function ExplorePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("birthdate, onboarded").eq("id", user.id).single();
  if (!profile) redirect("/login");
  if (!profile.onboarded) redirect("/onboarding");

  let q = supabase
    .from("content_items")
    .select("id, type, tag, text, attributed_to, video_id, view_count, person_id")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(80);
  if (!isAdult(profile.birthdate)) q = q.eq("maturity_rating", "general");

  const { data } = await q;
  const items = (data ?? []) as Row[];

  const newest = items.slice(0, 10);
  const trending = [...items].sort((a, b) => b.view_count - a.view_count).slice(0, 10);

  const tagCounts = new Map<string, number>();
  items.forEach((i) => tagCounts.set(i.tag, (tagCounts.get(i.tag) ?? 0) + 1));

  const people = new Map<string, { name: string; count: number }>();
  items.forEach((i) => {
    if (!i.person_id) return;
    const p = people.get(i.person_id) ?? { name: i.attributed_to, count: 0 };
    p.count += 1;
    people.set(i.person_id, p);
  });

  return (
    <Shell>
      <div style={{ padding: "20px 20px 18px" }}>
        <Logo />
        <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.slate }}>Find something worth your time.</p>
      </div>

      {items.length === 0 ? (
        <p style={{ padding: 28, color: COLORS.slate, fontSize: 13 }}>Nothing to explore yet.</p>
      ) : (
        <>
          <Section title="Topics">
            <div className="mf-scroll" style={rowStyle}>
              {[...tagCounts.entries()].map(([tag, n]) => (
                <Link
                  key={tag}
                  href={`/feed?tag=${encodeURIComponent(tag)}`}
                  style={{
                    flexShrink: 0,
                    padding: "8px 14px",
                    borderRadius: 20,
                    border: `1px solid ${tagColor(tag)}`,
                    color: tagColor(tag),
                    fontSize: 12,
                    textDecoration: "none",
                  }}
                >
                  {tag} · {n}
                </Link>
              ))}
            </div>
          </Section>

          <Section title="Trending">
            <div className="mf-scroll" style={rowStyle}>
              {trending.map((i) => (
                <ContentCard key={i.id} item={i} />
              ))}
            </div>
          </Section>

          <Section title="New">
            <div className="mf-scroll" style={rowStyle}>
              {newest.map((i) => (
                <ContentCard key={i.id} item={i} />
              ))}
            </div>
          </Section>

          {people.size > 0 && (
            <Section title="People">
              <div className="mf-scroll" style={rowStyle}>
                {[...people.entries()].map(([id, p]) => (
                  <Link
                    key={id}
                    href={`/people/${id}`}
                    style={{
                      flexShrink: 0,
                      width: 110,
                      textAlign: "center",
                      textDecoration: "none",
                      color: COLORS.parchment,
                    }}
                  >
                    <div
                      style={{
                        width: 64,
                        height: 64,
                        margin: "0 auto 8px",
                        borderRadius: "50%",
                        background: "rgba(201,162,39,0.15)",
                        color: COLORS.brass,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "'Newsreader', serif",
                        fontStyle: "italic",
                        fontSize: 26,
                      }}
                    >
                      {p.name[0]?.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 12 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: COLORS.slate }}>
                      {p.count} {p.count === 1 ? "item" : "items"}
                    </div>
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </Shell>
  );
}
