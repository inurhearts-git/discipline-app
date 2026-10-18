import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayStr } from "@/lib/constants";
import { bestStreak, streakThroughYesterday } from "@/lib/streak";
import { ProfileClient } from "@/components/profile/ProfileClient";
import type { Profile } from "@/lib/database.types";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile) redirect("/login");

  const admin = createAdminClient();
  const { data: usage } = await admin
    .from("usage_sessions")
    .select("ms_spent")
    .eq("user_id", user.id)
    .eq("date", todayStr())
    .maybeSingle();

  // Blueprint §9: "view own usage history (a small chart: minutes/day over
  // the last 7-30 days)". Build the last 7 days here, filling in any day
  // with no usage_sessions row as 0, so the chart always has a full week.
  const dateList: string[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dateList.push(d.toISOString().slice(0, 10));
  }
  const { data: usageRows } = await admin
    .from("usage_sessions")
    .select("date, ms_spent")
    .eq("user_id", user.id)
    .gte("date", dateList[0]);
  const byDate = new Map((usageRows ?? []).map((r) => [r.date, r.ms_spent]));
  const usageHistory = dateList.map((date) => ({ date, msSpent: byDate.get(date) ?? 0 }));

  // Streak numbers. "Base" is the run ending yesterday and "bestPast" the longest
  // run before today; the client adds today live (so the dev usage reset keeps it right).
  const todayKey = todayStr();
  const { data: allUsage } = await admin
    .from("usage_sessions")
    .select("date, ms_spent")
    .eq("user_id", user.id)
    .order("date", { ascending: false })
    .limit(1000);
  const pastRows = (allUsage ?? []).filter((r) => r.date < todayKey);
  const streakBase = streakThroughYesterday(pastRows, todayKey);
  const bestPast = bestStreak(pastRows);

  const { count: savedCount } = await supabase
    .from("user_content_interactions")
    .select("content_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("saved", true);
  // Errors (e.g. migration 0007 not run yet) just show 0.
  const { count: reflectionCount } = await supabase
    .from("reflections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  let pendingCount = 0;
  if (profile.role === "admin") {
    const { count } = await supabase
      .from("content_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    pendingCount = count ?? 0;
  }

  return (
    <ProfileClient
      profile={profile}
      usageMs={usage?.ms_spent ?? 0}
      usageHistory={usageHistory}
      streakBase={streakBase}
      bestPast={bestPast}
      pendingCount={pendingCount}
      savedCount={savedCount ?? 0}
      reflectionCount={reflectionCount ?? 0}
    />
  );
}
