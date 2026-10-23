// Error monitoring for the daily jobs (backlog item 3e).
//
// monitorCron() runs a job, records the result in cron_runs (migration 0016)
// and, when it fails, logs it and emails the operator if email is set up:
//   RESEND_API_KEY  your Resend API key
//   ALERT_EMAIL     where alerts go (before your domain is verified in
//                   Resend, this must be the email your Resend account uses)
//   ALERT_FROM      optional; defaults to Resend's test sender
// Without those, failures still show on Profile and the Admins page.
// Server-only.

import type { SupabaseClient } from "@supabase/supabase-js";
import { noticeJobFailed } from "@/lib/notifications";

export const JOBS = [
  { id: "purge-deleted", label: "Erase deleted accounts", hourUtc: 3 },
  { id: "refill", label: "Auto refill", hourUtc: 4 },
  // Runs every two hours (vercel.json); hourUtc is its first run.
  { id: "notices", label: "Notices", hourUtc: 0 },
] as const;
export type JobId = (typeof JOBS)[number]["id"] | "alert-test";

// A daily job that hasn't finished for this long counts as not running.
const STALE_HOURS = 26;

export interface JobOutcome {
  ok: boolean;
  summary: string;
  details?: unknown;
}

export interface MonitoredOutcome extends JobOutcome {
  recorded: boolean; // false until migration 0016 is run
  alert: { ok: boolean; reason?: string } | null; // null when the job worked
}

export async function monitorCron(admin: SupabaseClient, job: JobId, run: () => Promise<JobOutcome>): Promise<MonitoredOutcome> {
  const startedAt = new Date().toISOString();
  let outcome: JobOutcome;
  try {
    outcome = await run();
  } catch (e) {
    outcome = { ok: false, summary: `Crashed: ${e instanceof Error ? e.message : String(e)}` };
  }

  const { error } = await admin.from("cron_runs").insert({
    job,
    ok: outcome.ok,
    summary: outcome.summary.slice(0, 1000),
    details: outcome.details ?? null,
    started_at: startedAt,
  });
  const recorded = !error;
  if (error && error.code !== "42P01" && error.code !== "PGRST205") console.error(`[cron:${job}] couldn't record run: ${error.message}`);
  // Keep the table small.
  await admin.from("cron_runs").delete().lt("finished_at", new Date(Date.now() - 90 * 864e5).toISOString());

  let alert: MonitoredOutcome["alert"] = null;
  if (!outcome.ok) {
    console.error(`[cron:${job}] FAILED: ${outcome.summary}`);
    alert = await sendAlert(`Discipline: "${job}" job failed`, `${outcome.summary}\n\nStarted ${startedAt} (UTC).\nSee Profile > Admins for details.`);
    if (!alert.ok && alert.reason !== "not configured") console.error(`[cron:${job}] alert email failed: ${alert.reason}`);
    // And a notice under the bell for every admin (migration 0017).
    const label = JOBS.find((j) => j.id === job)?.label ?? (job === "alert-test" ? "Test alert" : job);
    await noticeJobFailed(admin, job, label, outcome.summary);
  }
  return { ...outcome, recorded, alert };
}

export function alertEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.ALERT_EMAIL);
}

export async function sendAlert(subject: string, text: string): Promise<{ ok: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL;
  if (!key || !to) return { ok: false, reason: "not configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.ALERT_FROM || "Discipline alerts <onboarding@resend.dev>", to: [to], subject, text }),
    });
    if (res.ok) return { ok: true };
    const body = await res.text().catch(() => "");
    return { ok: false, reason: `Resend said ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}` };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "network error" };
  }
}

export interface JobHealth {
  id: string;
  label: string;
  lastRunAt: string | null;
  lastOk: boolean | null;
  lastSummary: string | null;
  stale: boolean; // no run in STALE_HOURS
  problem: string | null; // a short warning, or null when healthy
}

// Latest run of each daily job. Null when migration 0016 isn't run yet.
export async function jobHealth(admin: SupabaseClient): Promise<JobHealth[] | null> {
  const out: JobHealth[] = [];
  for (const j of JOBS) {
    const { data, error } = await admin
      .from("cron_runs")
      .select("ok, summary, finished_at")
      .eq("job", j.id)
      .order("finished_at", { ascending: false })
      .limit(1);
    if (error) return null;
    const last = data?.[0] as { ok: boolean; summary: string; finished_at: string } | undefined;
    const stale = !!last && Date.now() - Date.parse(last.finished_at) > STALE_HOURS * 3600e3;
    let problem: string | null = null;
    if (last && !last.ok) problem = `${j.label} failed: ${last.summary}`;
    // No row yet (just deployed, or migration 0016 just run): not a warning.
    else if (stale) problem = `${j.label} hasn't run for over a day.`;
    out.push({ id: j.id, label: j.label, lastRunAt: last?.finished_at ?? null, lastOk: last?.ok ?? null, lastSummary: last?.summary ?? null, stale, problem });
  }
  return out;
}
