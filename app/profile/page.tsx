import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { erasureStatus, listAdmins } from "@/lib/admins";
import { jobHealth } from "@/lib/cron-monitor";
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

  // Journal: entry count and the latest entry's time (0 / null before migration 0008).
  const { data: latestEntries, count: journalCount } = await supabase
    .from("journal_entries")
    .select("created_at", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  let pendingCount = 0;
  let adminAlert: { lone: boolean; overdue: number; jobProblems: string[] } | null = null;
  if (profile.role === "admin") {
    // Lone-admin and overdue-erasure warnings (backlog 3a). Errors skip the warning.
    const svc = createAdminClient();
    const [admins, erasure, jobs] = await Promise.all([listAdmins(svc).catch(() => null), erasureStatus(svc), jobHealth(svc)]);
    const lone = admins !== null && admins.length <= 1;
    const overdue = erasure?.overdue ?? 0;
    const jobProblems = (jobs ?? []).map((j) => j.problem).filter((p): p is string => !!p);
    if (lone || overdue > 0 || jobProblems.length) adminAlert = { lone, overdue, jobProblems };

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
      adminAlert={adminAlert}
      savedCount={savedCount ?? 0}
      reflectionCount={reflectionCount ?? 0}
      journalCount={journalCount ?? 0}
      lastJournalAt={latestEntries?.[0]?.created_at ?? null}
    />
  );
}
