import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getQuoteOfTheDay } from "@/lib/qotd-server";
import { getTodayReflection } from "@/lib/reflection";
import { TodayClient } from "@/components/feed/TodayClient";
import { userToday } from "@/lib/day-server";

// Quote of the day: one quote or scripture, the same for everyone, new at the person's own midnight.
// Reached from the sun button in the feed header.
export default async function TodayPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { today } = await userToday(supabase, user.id);
  const item = await getQuoteOfTheDay(supabase, today);

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

  const reflection = await getTodayReflection(supabase, user.id, today);

  let hasMeaning = false;
  if (item) {
    const { data: m } = await supabase.from("content_meanings").select("content_id").eq("content_id", item.id).eq("status", "approved").maybeSingle();
    hasMeaning = !!m;
  }

  return <TodayClient item={item} initialLiked={liked} initialSaved={saved} initialReflection={reflection} hasMeaning={hasMeaning} />;
}
