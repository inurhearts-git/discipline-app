import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DAILY_LIMIT_MS, todayStr } from "@/lib/constants";
import { FeedClient } from "@/components/feed/FeedClient";
import type { ContentItem, Profile } from "@/lib/database.types";

export default async function FeedPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile) redirect("/login");
  if (!profile.onboarded) redirect("/onboarding");

  // Usage is read with the admin client because there's no client-facing
  // read policy on usage_sessions beyond "your own row" — using the same
  // server-authoritative path as the heartbeat route keeps this consistent.
  const admin = createAdminClient();
  const { data: usage } = await admin
    .from("usage_sessions")
    .select("ms_spent")
    .eq("user_id", user.id)
    .eq("date", todayStr())
    .maybeSingle();

  const msSpentToday = usage?.ms_spent ?? 0;
  if (msSpentToday >= DAILY_LIMIT_MS) redirect("/limit");

  let itemsQuery = supabase
    .from("content_items")
    .select("id, type, tag, text, attributed_to, source, video_platform, video_id, view_count")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (profile.interests?.length) {
    itemsQuery = itemsQuery.in("tag", profile.interests);
  }

  const { data: items } = await itemsQuery.returns<ContentItem[]>();

  const { data: interactions } = await supabase
    .from("user_content_interactions")
    .select("content_id, liked, saved")
    .eq("user_id", user.id);

  const liked: Record<string, boolean> = {};
  const saved: Record<string, boolean> = {};
  for (const row of interactions ?? []) {
    liked[row.content_id] = row.liked;
    saved[row.content_id] = row.saved;
  }

  return (
    <FeedClient
      items={items ?? []}
      profile={profile}
      initialLiked={liked}
      initialSaved={saved}
      initialMsSpentToday={msSpentToday}
    />
  );
}
