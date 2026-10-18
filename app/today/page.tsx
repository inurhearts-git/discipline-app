import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getQuoteOfTheDay } from "@/lib/qotd-server";
import { TodayClient } from "@/components/feed/TodayClient";

// Quote of the day: one quote or scripture, the same for everyone, new each UTC day.
// Reached from the sun button in the feed header.
export default async function TodayPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const item = await getQuoteOfTheDay(supabase);

  let liked = false;
  let saved = false;
  if (item) {
    const { data: row } = await supabase
      .from("user_content_interactions")
      .select("liked, saved")
      .eq("user_id", user.id)
      .eq("content_id", item.id)
      .maybeSingle<{ liked: boolean; saved: boolean }>();
    liked = row?.liked ?? false;
    saved = row?.saved ?? false;
  }

  return <TodayClient item={item} initialLiked={liked} initialSaved={saved} />;
}
