import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CollectionsClient } from "@/components/profile/CollectionsClient";
import { COLLECTION_COLUMNS, type Collection } from "@/lib/collections";

export const dynamic = "force-dynamic";

export default async function CollectionsAdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") redirect("/feed");

  const admin = createAdminClient();
  const { data, error } = await admin.from("collections").select(COLLECTION_COLUMNS).order("sort_order", { ascending: true }).returns<Collection[]>();

  // How many approved items each collection currently holds.
  const counts: Record<string, number> = {};
  for (const c of data ?? []) {
    let q = admin.from("content_items").select("id", { count: "exact", head: true }).eq("status", "approved").eq("maturity_rating", "general");
    if (c.tags.length) q = q.in("tag", c.tags);
    if (c.moods.length) q = q.overlaps("moods", c.moods);
    const { count } = await q;
    counts[c.id] = count ?? 0;
  }

  return <CollectionsClient initial={data ?? []} counts={counts} missingTable={!!error} />;
}
