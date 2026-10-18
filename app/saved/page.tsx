import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SavedClient, type SavedItem } from "@/components/profile/SavedClient";

interface SavedRow {
  content_id: string;
  saved_at: string | null;
}

// Everything this person has bookmarked, most recently saved first. Saves made
// before migration 0006 have no saved_at and sort to the end.
export default async function SavedPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("user_content_interactions")
    .select("content_id, saved_at")
    .eq("user_id", user.id)
    .eq("saved", true)
    .order("saved_at", { ascending: false, nullsFirst: false })
    .limit(500)
    .returns<SavedRow[]>();

  const ids = (rows ?? []).map((r) => r.content_id);
  let items: SavedItem[] = [];
  if (ids.length) {
    const { data } = await supabase
      .from("content_items")
      .select("id, type, tag, text, attributed_to, source")
      .in("id", ids)
      .eq("status", "approved")
      .returns<SavedItem[]>();
    const byId = new Map((data ?? []).map((i) => [i.id, i]));
    items = ids.map((id) => byId.get(id)).filter((i): i is SavedItem => !!i);
  }

  return <SavedClient items={items} />;
}
