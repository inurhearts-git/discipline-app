// The notices job (backlog item 8n). Runs every two hours (see vercel.json)
// and does three things:
//   1. "Streak at risk": people who counted yesterday but not yet today get
//      one reminder, in their own evening, while there is still time.
//   2. Once a day (from 06:00 UTC, after erasure and auto refill have run):
//      tells admins about submissions waiting, overdue erasures and jobs that
//      stopped running.
//   3. Deletes read notices older than 90 days (and any older than a year).
// Server-only.

import type { SupabaseClient } from "@supabase/supabase-js";
import { STREAK_MIN_MS, streakThroughYesterday } from "@/lib/streak";
import { erasureStatus } from "@/lib/admins";
import { jobHealth, type JobOutcome } from "@/lib/cron-monitor";
import { addDays, dayIn, hourIn, safeZone } from "@/lib/day";
import { isMissing, notify, notifyAdmins, noticeSubmissionsWaiting, utcDay } from "@/lib/notifications";

// Each person's day runs midnight to midnight in their own time zone (the
// one their device reports, saved with their notice settings; UTC if none).
// The reminder goes out in their evening, so there are always 2+ hours left.
const EVENING_FROM = 18; // local hour
const EVENING_TO = 22;
const ADMIN_CHECK_FROM_UTC = 6;

// Is now their evening (18:00 to 22:00)? The job runs every two hours, so
// every zone gets two chances, even when Vercel starts a run up to 59 minutes late.
export function atRiskDue(now: Date, tz: string): boolean {
  const h = hourIn(tz, now);
  return h >= EVENING_FROM && h < EVENING_TO;
}

interface Settings {
  user_id: string;
  streak: boolean;
  time_zone: string | null;
}

// Every qualifying day (2+ minutes) per person, for the dates any zone could
// call "today" or "yesterday" right now (UTC date -2 to +1).
async function recentQualifyingDays(admin: SupabaseClient, now: Date): Promise<Map<string, Set<string>>> {
  const utc = utcDay(now);
  const out = new Map<string, Set<string>>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("usage_sessions")
      .select("user_id, date")
      .gte("date", addDays(utc, -2))
      .lte("date", addDays(utc, 1))
      .gte("ms_spent", STREAK_MIN_MS)
      .order("user_id")
      .order("date")
      .range(from, from + 999);
    if (error) throw new Error(`read usage: ${error.message}`);
    for (const r of data ?? []) {
      const set = out.get(r.user_id as string) ?? new Set<string>();
      set.add(r.date as string);
      out.set(r.user_id as string, set);
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

export interface AtRiskResult {
  candidates: number; // counted yesterday, not yet today (their own days)
  due: number; // of those, in their evening now
  sent: number;
}

export async function sendStreakAtRisk(admin: SupabaseClient, now = new Date()): Promise<AtRiskResult> {
  const days = await recentQualifyingDays(admin, now);
  const people = Array.from(days.keys());
  const result: AtRiskResult = { candidates: 0, due: 0, sent: 0 };

  for (let i = 0; i < people.length; i += 200) {
    const chunk = people.slice(i, i + 200);
    const { data: settingsRows, error } = await admin.from("notification_settings").select("user_id, streak, time_zone").in("user_id", chunk);
    if (error) throw new Error(`read settings: ${error.message}`);
    const settings = new Map(((settingsRows ?? []) as Settings[]).map((s) => [s.user_id, s]));

    for (const id of chunk) {
      const tz = safeZone(settings.get(id)?.time_zone ?? null);
      const today = dayIn(tz, now);
      const counted = days.get(id) as Set<string>;
      if (!counted.has(addDays(today, -1)) || counted.has(today)) continue;
      result.candidates++;
      if (settings.get(id)?.streak === false || !atRiskDue(now, tz)) continue;
      result.due++;

      // Streak length, for the wording (at most 400 rows: under the API's 1,000-row cap).
      const { data: rows, error: usageError } = await admin
        .from("usage_sessions")
        .select("date, ms_spent")
        .eq("user_id", id)
        .gte("date", addDays(today, -400))
        .lt("date", today)
        .gte("ms_spent", STREAK_MIN_MS);
      if (usageError) throw new Error(`read streak: ${usageError.message}`);
      const n = Math.max(1, streakThroughYesterday((rows ?? []).map((r) => ({ date: r.date as string, ms_spent: Number(r.ms_spent) })), today));
      result.sent += await notify(admin, {
        users: [id],
        kind: "streak_at_risk",
        key: `streak_at_risk:${today}`,
        title: n === 1 ? "Make it two days in a row" : `Keep your ${n}-day streak going`,
        body: n === 1 ? "You showed up yesterday. Spend 2 minutes in the feed before midnight to keep going." : "Spend 2 minutes in the feed before midnight to keep it.",
        link: "/feed",
      });
    }
  }
  return result;
}

export interface AdminCheckResult {
  ran: boolean;
  overdue: number;
  staleJobs: number;
}

export async function adminDailyChecks(admin: SupabaseClient, now = new Date()): Promise<AdminCheckResult> {
  if (now.getUTCHours() < ADMIN_CHECK_FROM_UTC) return { ran: false, overdue: 0, staleJobs: 0 };
  const day = utcDay(now);
  await noticeSubmissionsWaiting(admin, false);

  const erasure = await erasureStatus(admin);
  const overdue = erasure?.overdue ?? 0;
  if (overdue > 0) {
    await notifyAdmins(admin, {
      kind: "admin_erasures",
      key: `admin_erasures:${day}`,
      title: overdue === 1 ? "1 deleted account is overdue for erasure" : `${overdue} deleted accounts are overdue for erasure`,
      body: "Open Admins and press Run erasure now to see why.",
      link: "/moderate/admins",
    });
  }

  const jobs = (await jobHealth(admin)) ?? [];
  const stale = jobs.filter((j) => j.stale && j.lastOk !== false && j.id !== "notices");
  for (const j of stale) {
    await notifyAdmins(admin, {
      kind: "admin_job_failed",
      key: `admin_job_stale:${j.id}:${day}`,
      title: `${j.label} hasn't run for over a day`,
      body: "Check the cron jobs in Vercel and the Daily jobs list on the Admins page.",
      link: "/moderate/admins",
    });
  }
  return { ran: true, overdue, staleJobs: stale.length };
}

export async function cleanupNotices(admin: SupabaseClient, now = new Date()): Promise<number> {
  const readCutoff = new Date(now.getTime() - 90 * 864e5).toISOString();
  const anyCutoff = new Date(now.getTime() - 365 * 864e5).toISOString();
  const a = await admin.from("notifications").delete({ count: "exact" }).lt("read_at", readCutoff);
  if (a.error) throw new Error(`clean up: ${a.error.message}`);
  const b = await admin.from("notifications").delete({ count: "exact" }).lt("created_at", anyCutoff);
  if (b.error) throw new Error(`clean up: ${b.error.message}`);
  return (a.count ?? 0) + (b.count ?? 0);
}

export async function runNoticesJob(admin: SupabaseClient, now = new Date()): Promise<JobOutcome> {
  // Before migration 0017 there is nothing to do, and that isn't a failure.
  const probe = await admin.from("notifications").select("id", { head: true, count: "exact" }).limit(1);
  if (probe.error && isMissing(probe.error.code)) return { ok: true, summary: "Skipped: run migration 0017 to switch notices on." };
  if (probe.error) return { ok: false, summary: `Couldn't read notifications: ${probe.error.message}` };

  const risk = await sendStreakAtRisk(admin, now);
  const checks = await adminDailyChecks(admin, now);
  const removed = await cleanupNotices(admin, now);
  const parts = [`Streak reminders: ${risk.sent} sent (${risk.due} due of ${risk.candidates} at risk).`];
  if (checks.ran) parts.push(`Admin checks done${checks.overdue ? `, ${checks.overdue} overdue erasures` : ""}${checks.staleJobs ? `, ${checks.staleJobs} stalled jobs` : ""}.`);
  if (removed) parts.push(`Removed ${removed} old notices.`);
  return { ok: true, summary: parts.join(" "), details: { risk, checks, removed } };
}
