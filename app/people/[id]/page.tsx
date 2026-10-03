import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { COLORS, isAdult, fmtCount } from "@/lib/constants";
import { Shell } from "@/components/ui/Shell";
import { ContentCard, type CardItem } from "@/components/explore/ContentCard";

export default async function PersonPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("birthdate").eq("id", user.id).single();

  let q = supabase
    .from("content_items")
    .select("id, type, tag, text, attributed_to, video_id, view_count")
    .eq("person_id", params.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (!isAdult(profile?.birthdate)) q = q.eq("maturity_rating", "general");

  const { data } = await q;
  const items = (data ?? []) as CardItem[];
  if (items.length === 0) notFound();

  const totalViews = items.reduce((s, i) => s + (i.view_count ?? 0), 0);

  return (
    <Shell>
      <div style={{ padding: "20px 20px 8px" }}>
        <Link href="/explore" style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 13, color: COLORS.slate, textDecoration: "none" }}>
          <ChevronLeft size={16} /> Explore
        </Link>
        <h1 style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontWeight: 400, fontSize: 30, color: COLORS.parchment, margin: "14px 0 4px" }}>
          {items[0].attributed_to}
        </h1>
        <p style={{ margin: 0, fontSize: 12, color: COLORS.slate }}>
          {items.length} {items.length === 1 ? "item" : "items"} · {fmtCount(totalViews)} views
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "16px 20px 24px" }}>
        {items.map((i) => (
          <ContentCard key={i.id} item={i} width="100%" />
        ))}
      </div>
    </Shell>
  );
}
