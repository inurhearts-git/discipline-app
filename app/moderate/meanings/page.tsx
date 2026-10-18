import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MeaningsClient, type MeaningRow } from "@/components/profile/MeaningsClient";
import { meaningConfigured } from "@/lib/meaning";

// Admin review of plain-language meanings: Claude drafts, an admin edits and approves.
export default async function MeaningsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single<{ role: string }>();
  if (profile?.role !== "admin") redirect("/feed");

  const admin = createAdminClient();
  const [{ data: items }, { data: meanings, error }] = await Promise.all([
    admin
      .from("content_items")
      .select("id, text, attributed_to, source, tag")
      .eq("status", "approved")
      .neq("type", "video")
      .order("created_at", { ascending: false })
      .limit(5000)
      .returns<{ id: string; text: string; attributed_to: string | null; source: string | null; tag: string }[]>(),
    admin.from("content_meanings").select("content_id, text, status, source").limit(10000).returns<{ content_id: string; text: string; status: string; source: string }[]>(),
  ]);

  const byId = new Map((meanings ?? []).map((m) => [m.content_id, m]));
  const rows: MeaningRow[] = (items ?? []).map((i) => {
    const m = byId.get(i.id);
    return { ...i, meaning: m?.text ?? "", status: (m?.status as MeaningRow["status"]) ?? "missing" };
  });

  return <MeaningsClient rows={rows} claudeReady={meaningConfigured()} tableReady={!error} />;
}
