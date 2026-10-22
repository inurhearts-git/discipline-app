// Admin safety (backlog item 3a): who the admins are, changing roles, and the
// account-erasure run with a clear report. Server-only (uses the service-role
// client passed in).

import type { SupabaseClient } from "@supabase/supabase-js";
import { PurgeError, purgeAccount } from "@/lib/account-archive";

export type Role = "viewer" | "creator" | "admin";
export const ROLES: Role[] = ["viewer", "creator", "admin"];

export interface AdminPerson {
  id: string;
  display_name: string;
  email: string;
  created_at: string;
}

// Active admins (accounts waiting out their deletion window don't count).
export async function listAdmins(admin: SupabaseClient): Promise<AdminPerson[]> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, display_name, email, created_at")
    .eq("role", "admin")
    .is("account_deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`list admins: ${error.message}`);
  return (data ?? []) as AdminPerson[];
}

export interface ErasureStatus {
  waiting: number; // deleted accounts still inside their restore window
  overdue: number; // past the window and not yet erased
  oldestOverdue: string | null; // purge_after of the oldest overdue one
}

// The daily run is at 03:00 UTC, so anything more than a day past its window
// means a run failed or was skipped.
export async function erasureStatus(admin: SupabaseClient): Promise<ErasureStatus | null> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const waitingQ = await admin.from("account_archives").select("user_id", { count: "exact", head: true }).gte("purge_after", now.toISOString());
  const overdueQ = await admin
    .from("account_archives")
    .select("purge_after", { count: "exact" })
    .lt("purge_after", dayAgo)
    .order("purge_after", { ascending: true })
    .limit(1);
  if (waitingQ.error || overdueQ.error) return null; // before migration 0012
  return {
    waiting: waitingQ.count ?? 0,
    overdue: overdueQ.count ?? 0,
    oldestOverdue: (overdueQ.data?.[0]?.purge_after as string | undefined) ?? null,
  };
}

export interface PurgeReport {
  due: number;
  purged: number;
  failed: { userId: string; reason: string }[];
  blocked: string | null; // set when nothing could run at all
}

// Erases accounts past their restore window. Never fails quietly: a missing
// admin stops the run with a reason, and each failed account says why.
export async function runPurge(admin: SupabaseClient, limit = 50): Promise<PurgeReport> {
  const { data: due, error } = await admin
    .from("account_archives")
    .select("user_id")
    .lt("purge_after", new Date().toISOString())
    .order("purge_after", { ascending: true })
    .limit(limit);
  if (error) return { due: 0, purged: 0, failed: [], blocked: `couldn't read archives: ${error.message}` };

  const report: PurgeReport = { due: due?.length ?? 0, purged: 0, failed: [], blocked: null };
  if (!report.due) return report;

  const admins = await listAdmins(admin).catch(() => null);
  if (admins === null) return { ...report, blocked: "couldn't look up admins" };
  if (admins.length === 0) {
    return { ...report, blocked: "no other admin: erased accounts hand their submissions to an admin, so make someone an admin first" };
  }

  for (const row of due ?? []) {
    const userId = row.user_id as string;
    try {
      await purgeAccount(admin, userId);
      report.purged++;
    } catch (e) {
      report.failed.push({ userId, reason: e instanceof PurgeError ? e.message : "unexpected error" });
    }
  }
  return report;
}

export function purgeSummary(r: PurgeReport): string {
  if (r.blocked) return `Erasure blocked: ${r.blocked}. ${r.due} account${r.due === 1 ? "" : "s"} waiting.`;
  if (!r.due) return "Nothing to erase.";
  const parts = [`Erased ${r.purged} of ${r.due}.`];
  if (r.failed.length) parts.push(`${r.failed.length} failed: ${Array.from(new Set(r.failed.map((f) => f.reason))).join("; ")}.`);
  return parts.join(" ");
}

// Turns a database error from the role guard (migration 0015) into a message.
export function roleErrorMessage(message: string | undefined): string {
  const m = message ?? "";
  if (/last admin/i.test(m)) return "Can't remove the last admin. Make someone else an admin first.";
  if (/Only an admin can change/i.test(m)) return "The database refused the change. Run migration 0015 in Supabase, then try again.";
  return "Couldn't change the role. Try again.";
}
