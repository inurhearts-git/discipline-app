import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ReportsClient, type ReportRow } from "@/components/profile/ReportsClient";

export default async function ReportsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") redirect("/feed");

  // Reports are only readable with the service-role key, after the admin check above.
  const admin = createAdminClient();
  const { data: reports } = await admin
    .from("content_reports")
    .select("id, content_id, reason, note, created_at")
    .eq("status", "open")
    .order("created_at", { ascending: true })
    .limit(200);

  const ids = Array.from(new Set((reports ?? []).map((r) => r.content_id)));
  const { data: items } = ids.length
    ? await admin.from("content_items").select("id, text, attributed_to, source, tag").in("id", ids)
    : { data: [] };
  const byId = new Map((items ?? []).map((i) => [i.id, i]));

  const rows: ReportRow[] = (reports ?? [])
    .map((r) => {
      const item = byId.get(r.content_id);
      if (!item) return null;
      return {
        id: r.id,
        contentId: r.content_id,
        reason: r.reason,
        note: r.note,
        createdAt: r.created_at,
        text: item.text,
        attributedTo: item.attributed_to,
        source: item.source,
        tag: item.tag,
      };
    })
    .filter((r): r is ReportRow => r !== null);

  return <ReportsClient initial={rows} />;
}
