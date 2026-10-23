// The notices job (backlog item 8n). Runs every hour (see vercel.json)
// and does three things:
//   1. "Streak at risk": people who counted yesterday but not yet today get
//      one reminder about 3 hours before their own midnight.
//   1b. "We miss you": a push nudge after 2 whole days away, and after 10.
//   2. Once a day (from 06:00 UTC, after erasure and auto refill have run):
//      tells admins about submissions waiting, overdue erasures and jobs that
//      stopped running.
//   3. Deletes read notices older than 90 days (and any older than a year).
// Server-only.

import type { SupabaseClient } from "@supabase/supabase-js";
import { STREAK_MIN_MS, streakThroughYesterday } from "@/lib/streak";
import { erasureStatus } from "@/lib/admins";
import { jobHealth, type JobOutcome } from "@/lib/cron-monitor";
import { addDays, dayIn, hourIn, nextMidnight, safeZone } from "@/lib/day";
import { isMissing, notify, notifyAdmins, noticeSubmissionsWaiting, utcDay } from "@/lib/notifications";

// Each person's day runs midnight to midnight in their own time zone (the
// one their device reports, saved with their notice settings; UTC if none).
// The reminder goes out about 3 hours before their midnight.
const EVENING_FROM = 20; // local hour
const EVENING_TO = 22;
const ADMIN_CHECK_FROM_UTC = 6;

// Is it 20:00 to 22:00 where they are (2 to 4 hours before midnight)? The job
// runs every hour, so every zone is reached even when Vercel starts a run up
// to 59 minutes late; each person gets it once a day.
export function atRiskDue(now: Date, tz: string): boolean {
  const h = hourIn(tz, now);
  return h >= EVENING_FROM && h < EVENING_TO;
}

// Whole hours left until their midnight, rounded down: "3 hours" from 20:00
// to 20:59, "2 hours" if the run is late and lands after 21:00.
export function hoursUntilMidnight(now: Date, tz: string): number {
  return Math.max(1, Math.floor((nextMidnight(tz, now).getTime() - now.getTime() - 1) / 3600e3));
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
  due: number; // of those, 2 to 4 hours before their midnight now
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
      const hours = hoursUntilMidnight(now, tz);
      const left = hours === 1 ? "1 hour" : `${hours} hours`;
      result.sent += await notify(admin, {
        users: [id],
        kind: "streak_at_risk",
        key: `streak_at_risk:${today}`,
        title: n === 1 ? `Your streak will end in ${left}` : `Your ${n}-day streak will end in ${left}`,
        body: "Keep up the good work and maintain your streak: spend a few minutes on the app before midnight.",
        link: "/feed",
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// "We miss you": a nudge to people who haven't opened the app for 2 whole
// days, and once more after 10. Push only (an in-app notice can't reach
// someone who isn't opening the app), so it goes to people who turned phone
// notifications on. Sent between 18:00 and 20:00 their time, once per absence
// per stage. Needs migration 0018 (last_seen_at, comeback switch).
// ---------------------------------------------------------------------------
const COMEBACK_FROM = 18;
const COMEBACK_TO = 20;
export const COMEBACK_STAGES = [
  { stage: 1, daysAway: 2, title: "We miss you", body: "It's been a few days. Spend a few minutes on the app today and start a new streak." },
  { stage: 2, daysAway: 10, title: "Still here when you're ready", body: "Today's quote is waiting for you. A few minutes is all it takes to start again." },
] as const;

// Whole days between their last visit and today, not counting either day.
export function daysAway(lastSeen: Date, now: Date, tz: string): number {
  const a = Date.parse(`${dayIn(tz, lastSeen)}T00:00:00Z`);
  const b = Date.parse(`${dayIn(tz, now)}T00:00:00Z`);
  return Math.round((b - a) / 864e5) - 1;
}

export function comebackStage(lastSeen: Date, now: Date, tz: string): (typeof COMEBACK_STAGES)[number] | null {
  const away = daysAway(lastSeen, now, tz);
  return [...COMEBACK_STAGES].reverse().find((s) => away >= s.daysAway) ?? null;
}

export interface ComebackResult {
  away: number; // with push on and away 2+ days
  due: number; // of those, in their 18:00-20:00 window
  sent: number;
}

interface SeenRow {
  user_id: string;
  time_zone: string | null;
  last_seen_at: string;
  comeback: boolean;
}

export async function sendComeback(admin: SupabaseClient, now = new Date()): Promise<ComebackResult | null> {
  const result: ComebackResult = { away: 0, due: 0, sent: 0 };
  // People with push on (only they can be reached).
  const withPush = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("push_subscriptions").select("user_id").range(from, from + 999);
    if (error) return null; // before migration 0018
    for (const r of data ?? []) withPush.add(r.user_id as string);
    if (!data || data.length < 1000) break;
  }
  if (!withPush.size) return result;

  const cutoff = new Date(now.getTime() - 2 * 864e5).toISOString(); // can't be 2 whole days away otherwise
  const ids = Array.from(withPush);
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await admin
      .from("notification_settings")
      .select("user_id, time_zone, last_seen_at, comeback")
      .in("user_id", ids.slice(i, i + 200))
      .lt("last_seen_at", cutoff);
    if (error) throw new Error(`read last visits: ${error.message}`);
    for (const row of (data ?? []) as SeenRow[]) {
      if (row.comeback === false) continue;
      const tz = safeZone(row.time_zone);
      const seen = new Date(row.last_seen_at);
      const stage = comebackStage(seen, now, tz);
      if (!stage) continue;
      result.away++;
      const h = hourIn(tz, now);
      if (h < COMEBACK_FROM || h >= COMEBACK_TO) continue;
      result.due++;
      result.sent += await notify(admin, {
        users: [row.user_id],
        kind: "comeback",
        key: `comeback:${dayIn(tz, seen)}:${stage.stage}`,
        title: stage.title,
        body: stage.body,
        link: "/today",
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
  const comeback = await sendComeback(admin, now);
  const checks = await adminDailyChecks(admin, now);
  const removed = await cleanupNotices(admin, now);
  const parts = [`Streak reminders: ${risk.sent} sent (${risk.due} due of ${risk.candidates} at risk).`];
  if (comeback) parts.push(`Come-back nudges: ${comeback.sent} sent (${comeback.due} due of ${comeback.away} away).`);
  if (checks.ran) parts.push(`Admin checks done${checks.overdue ? `, ${checks.overdue} overdue erasures` : ""}${checks.staleJobs ? `, ${checks.staleJobs} stalled jobs` : ""}.`);
  if (removed) parts.push(`Removed ${removed} old notices.`);
  return { ok: true, summary: parts.join(" "), details: { risk, comeback, checks, removed } };
}
