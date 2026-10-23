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
import { isMissing, notify, notifyAdmins, noticeSubmissionsWaiting, utcDay } from "@/lib/notifications";

// Each person's streak day ends at midnight UTC (the same day used by the
// daily limit). A reminder needs at least this long left to be useful.
const MIN_HOURS_LEFT = 2;
// ...and at most this long, so a reminder is never about a day that has only
// just started.
const MAX_HOURS_LEFT = 18;
const EVENING_FROM = 18; // local hour
const EVENING_TO = 22;
const ADMIN_CHECK_FROM_UTC = 6;

export function safeZone(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export function localHour(now: Date, tz: string): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: safeZone(tz), hour: "numeric", hourCycle: "h23" }).format(now);
  return Number(h) % 24;
}

// Is now a good moment to remind someone in this time zone?
// Normally: their evening (18:00 to 22:00), while the UTC day has between 2
// and 18 hours left. West of about UTC-2 the evening comes after the UTC day ends, so
// they get it in the last runs of the UTC day instead, if it's daytime there
// (09:00 to 22:00 local). Each person gets at most one a day either way.
export function atRiskDue(now: Date, tz: string): boolean {
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
  const left = 24 - utcHours;
  if (left < MIN_HOURS_LEFT) return false;
  const h = localHour(now, tz);
  if (h >= EVENING_FROM && h < EVENING_TO && left <= MAX_HOURS_LEFT) return true;
  return now.getUTCHours() >= 18 && h >= 9 && h < EVENING_TO;
}

// "4:00 am tomorrow" or "8:00 pm" in their zone: when the current UTC day ends.
export function dayEndsAt(now: Date, tz: string): string {
  const zone = safeZone(tz);
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const time = end.toLocaleTimeString("en-GB", { timeZone: zone, hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: zone });
  return day(end) === day(now) ? time : `${time} tomorrow`;
}

function prevDay(d: string, n = 1): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - n);
  return t.toISOString().slice(0, 10);
}

interface Settings {
  user_id: string;
  streak: boolean;
  time_zone: string | null;
}

async function idsWhere(admin: SupabaseClient, date: string, minMs: number): Promise<string[]> {
  const out: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("usage_sessions").select("user_id").eq("date", date).gte("ms_spent", minMs).range(from, from + 999);
    if (error) throw new Error(`read usage: ${error.message}`);
    out.push(...(data ?? []).map((r) => r.user_id as string));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export interface AtRiskResult {
  candidates: number; // counted yesterday, not yet today
  due: number; // of those, in their reminder window now
  sent: number;
}

export async function sendStreakAtRisk(admin: SupabaseClient, now = new Date()): Promise<AtRiskResult> {
  const today = utcDay(now);
  const yesterday = prevDay(today);
  const countedYesterday = await idsWhere(admin, yesterday, STREAK_MIN_MS);
  const countedToday = new Set(await idsWhere(admin, today, STREAK_MIN_MS));
  const candidates = countedYesterday.filter((id) => !countedToday.has(id));
  const result: AtRiskResult = { candidates: candidates.length, due: 0, sent: 0 };

  for (let i = 0; i < candidates.length; i += 200) {
    const chunk = candidates.slice(i, i + 200);
    const { data: settingsRows, error } = await admin.from("notification_settings").select("user_id, streak, time_zone").in("user_id", chunk);
    if (error) throw new Error(`read settings: ${error.message}`);
    const settings = new Map(((settingsRows ?? []) as Settings[]).map((s) => [s.user_id, s]));
    const due = chunk.filter((id) => settings.get(id)?.streak !== false && atRiskDue(now, settings.get(id)?.time_zone ?? "UTC"));
    if (!due.length) continue;
    result.due += due.length;

    for (const id of due) {
      const tz = settings.get(id)?.time_zone ?? "UTC";
      // Streak length, for the wording (at most 400 rows: under the API's 1,000-row cap).
      const { data: rows, error: usageError } = await admin
        .from("usage_sessions")
        .select("date, ms_spent")
        .eq("user_id", id)
        .gte("date", prevDay(today, 400))
        .lt("date", today)
        .gte("ms_spent", STREAK_MIN_MS);
      if (usageError) throw new Error(`read streak: ${usageError.message}`);
      const n = Math.max(1, streakThroughYesterday((rows ?? []).map((r) => ({ date: r.date as string, ms_spent: Number(r.ms_spent) })), today));
      const by = dayEndsAt(now, tz);
      const title = n === 1 ? "Make it two days in a row" : `Keep your ${n}-day streak going`;
      const body = n === 1 ? `You showed up yesterday. Spend 2 minutes in the feed before ${by} to keep going.` : `Spend 2 minutes in the feed before ${by} to keep it.`;
      result.sent += await notify(admin, {
        users: [id],
        kind: "streak_at_risk",
        key: `streak_at_risk:${today}`,
        title,
        body,
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
