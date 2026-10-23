import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NotificationsClient } from "@/components/notifications/NotificationsClient";
import type { NoticeRow } from "@/app/api/notifications/route";

export const dynamic = "force-dynamic";

// The bell's page: the signed-in person's notices, newest first. Row-level
// security limits the query to their own rows. Before migration 0017 it shows
// the empty state.
export default async function NotificationsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, count, created_at, read_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return <NotificationsClient initial={error ? [] : ((data ?? []) as NoticeRow[])} />;
}
