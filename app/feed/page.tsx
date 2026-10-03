import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DAILY_LIMIT_MS, isAdult, todayStr } from "@/lib/constants";
import { FeedClient } from "@/components/feed/FeedClient";
import type { ContentItem, Profile } from "@/lib/database.types";

const ITEM_COLUMNS = "id, type, tag, text, attributed_to, source, video_platform, video_id, view_count, maturity_rating";

export default async function FeedPage({
  searchParams,
}: {
  searchParams: { item?: string; tag?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile) redirect("/login");
  if (!profile.onboarded) redirect("/onboarding");

  const admin = createAdminClient();
  const { data: usage } = await admin
    .from("usage_sessions")
    .select("ms_spent")
    .eq("user_id", user.id)
    .eq("date", todayStr())
    .maybeSingle();

  const msSpentToday = usage?.ms_spent ?? 0;
  if (msSpentToday >= DAILY_LIMIT_MS) redirect("/limit");

  const adult = isAdult(profile.birthdate);

  let itemsQuery = supabase
    .from("content_items")
    .select(ITEM_COLUMNS)
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  // A topic picked from Explore overrides the saved interests for this visit.
  if (searchParams.tag) {
    itemsQuery = itemsQuery.eq("tag", searchParams.tag);
  } else if (profile.interests?.length) {
    itemsQuery = itemsQuery.in("tag", profile.interests);
  }

  if (!adult) {
    itemsQuery = itemsQuery.eq("maturity_rating", "general");
  }

  const { data } = await itemsQuery.returns<ContentItem[]>();
  let items = data ?? [];

  // Opened from an Explore card: put that item first so the feed starts there.
  const startId = searchParams.item;
  if (startId) {
    const found = items.find((i) => i.id === startId);
    if (found) {
      items = [found, ...items.filter((i) => i.id !== startId)];
    } else {
      let one = supabase.from("content_items").select(ITEM_COLUMNS).eq("id", startId).eq("status", "approved");
      if (!adult) one = one.eq("maturity_rating", "general");
      const { data: extra } = await one.maybeSingle<ContentItem>();
      if (extra) items = [extra, ...items];
    }
  }

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
      items={items}
      profile={profile}
      initialLiked={liked}
      initialSaved={saved}
      initialMsSpentToday={msSpentToday}
    />
  );
}
