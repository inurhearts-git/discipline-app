// In-app notifications (backlog item 8n, migration 0017). Server-only: every
// function takes the service-role client.
//
// Notices are only ever created through the database function notify(), which
// enforces the rules in one place:
//   - nothing for deleted accounts
//   - each person's switches on Profile (streak, collections, submissions);
//     admin notices are always on and only reach admins
//   - one notice per key (keys include the day, so a kind shows at most once a
//     day; a repeat either does nothing or "merges" into the same notice)
//   - at most 4 new non-admin notices per person per day
// The text never names or quotes other people.
//
// Nothing here ever throws: a notice that can't be created (for example before
// migration 0017 is run) is logged and skipped, so the action that triggered
// it (an approval, a report, a job) always goes ahead.

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPush } from "@/lib/push";

export const USER_KINDS = ["streak_milestone", "streak_at_risk", "collection_new", "submission_approved", "submission_rejected", "comeback"] as const;
export const ADMIN_KINDS = ["admin_job_failed", "admin_reports", "admin_submissions", "admin_erasures"] as const;
export type NoticeKind = (typeof USER_KINDS)[number] | (typeof ADMIN_KINDS)[number];

export { NOTICE_SETTINGS, DEFAULT_SETTINGS, type NoticeSettingId, type NoticeSettings } from "@/lib/notice-settings";

// Kinds that also go to the person's phone or browser when push is on
// (lib/push.ts). The first notice of the day only, never the merged repeats.
export const PUSH_KINDS: readonly NoticeKind[] = ["streak_at_risk", "comeback", "submission_approved", "submission_rejected", "admin_job_failed"];

// Postgres / PostgREST codes for "that table or function doesn't exist yet".
export function isMissing(code: string | undefined): boolean {
  return code === "42P01" || code === "42883" || code === "PGRST202" || code === "PGRST205";
}

// "2026-10-23" in UTC: used for notice keys (one notice per kind per day).
export function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

// First n characters of someone's own submission, on one line.
export function snippet(text: string, n = 60): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`;
}

export interface NotifyArgs {
  users: string[];
  kind: NoticeKind;
  key: string;
  title: string;
  titleMany?: string | null; // used once merged; "{n}" becomes the count
  body?: string | null;
  bodyMany?: string | null;
  link?: string | null; // a path inside the app, e.g. "/feed?item=…"
  merge?: boolean; // add to an existing notice with the same key instead of skipping
  count?: number | null; // when merging, set the count to this instead of adding 1
}

const CHUNK = 500;

// Creates (or merges) one notice per person. Returns how many were written.
export async function notify(admin: SupabaseClient, a: NotifyArgs): Promise<number> {
  const users = Array.from(new Set(a.users.filter(Boolean)));
  if (!users.length) return 0;
  let written = 0;
  for (let i = 0; i < users.length; i += CHUNK) {
    const { data, error } = await admin.rpc("notify", {
      p_users: users.slice(i, i + CHUNK),
      p_kind: a.kind,
      p_key: a.key.slice(0, 200),
      p_title: a.title.slice(0, 120),
      p_title_many: a.titleMany ? a.titleMany.slice(0, 120) : null,
      p_body: a.body ? a.body.slice(0, 300) : null,
      p_body_many: a.bodyMany ? a.bodyMany.slice(0, 300) : null,
      p_link: a.link ?? null,
      p_merge: a.merge === true,
      p_count: a.count ?? null,
    });
    if (error) {
      if (!isMissing(error.code)) console.error(`[notify:${a.kind}] ${error.message}`);
      return written;
    }
    const rows = (Array.isArray(data) ? data : []) as { user_id: string; count: number }[];
    written += rows.length;
    if (PUSH_KINDS.includes(a.kind)) {
      const fresh = rows.filter((r) => r.count === 1).map((r) => r.user_id);
      if (fresh.length) await sendPush(admin, fresh, { title: a.title, body: a.body, url: a.link, tag: a.kind });
    }
  }
  return written;
}

// Active admins (not waiting out a deletion).
export async function adminIds(admin: SupabaseClient): Promise<string[]> {
  const { data, error } = await admin.from("profiles").select("id").eq("role", "admin").is("account_deleted_at", null);
  if (error) {
    console.error(`[notify] couldn't list admins: ${error.message}`);
    return [];
  }
  return (data ?? []).map((r) => r.id as string);
}

export async function notifyAdmins(admin: SupabaseClient, a: Omit<NotifyArgs, "users">): Promise<number> {
  return notify(admin, { ...a, users: await adminIds(admin) });
}

// Every call below is fire-and-forget safe: it catches everything.
async function safe(label: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch (e) {
    console.error(`[notify:${label}] ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ---------------------------------------------------------------------------
// Creators: a submission was reviewed.
// ---------------------------------------------------------------------------

export interface ReviewedItem {
  id: string;
  text: string;
  type: string;
  submitted_by: string;
}

// Only creators hear about reviews. Admin-submitted and auto-added clips
// (filed under an admin) are skipped, and so is reviewing your own item.
export async function noticeSubmissionReviewed(
  admin: SupabaseClient,
  item: ReviewedItem,
  outcome: "approved" | "rejected",
  reviewerId: string,
  reason?: string | null
): Promise<void> {
  await safe("submission", async () => {
    if (!item.submitted_by || item.submitted_by === reviewerId) return;
    const { data: who } = await admin.from("profiles").select("role").eq("id", item.submitted_by).maybeSingle();
    if (who?.role !== "creator") return;
    const what = item.type === "video" ? "clip" : "submission";
    const quote = `“${snippet(item.text)}”`;
    const day = utcDay();
    if (outcome === "approved") {
      await notify(admin, {
        users: [item.submitted_by],
        kind: "submission_approved",
        key: `submission_approved:${day}`,
        title: `Your ${what} was approved`,
        titleMany: "{n} of your submissions were approved today",
        body: `${quote} is now in the feed.`,
        bodyMany: `The latest: ${quote}`,
        link: `/feed?item=${item.id}`,
        merge: true,
      });
    } else {
      const why = reason?.trim() ? ` Reason: ${snippet(reason, 200)}` : "";
      await notify(admin, {
        users: [item.submitted_by],
        kind: "submission_rejected",
        key: `submission_rejected:${day}`,
        title: `Your ${what} wasn't approved`,
        titleMany: "{n} of your submissions weren't approved today",
        body: `${quote}${why}`,
        bodyMany: `The latest: ${quote}${why}`,
        link: "/submit",
        merge: true,
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Admins: things waiting for them.
// ---------------------------------------------------------------------------

async function pendingCount(admin: SupabaseClient): Promise<number> {
  const { count } = await admin.from("content_items").select("id", { count: "exact", head: true }).eq("status", "pending");
  return count ?? 0;
}

// merge=true when something new just arrived (it becomes unread again);
// false for the once-a-day check, so it never re-raises the same notice.
export async function noticeSubmissionsWaiting(admin: SupabaseClient, merge = true): Promise<void> {
  await safe("admin_submissions", async () => {
    const n = await pendingCount(admin);
    if (n < 1) return;
    await notifyAdmins(admin, {
      kind: "admin_submissions",
      key: `admin_submissions:${utcDay()}`,
      title: "1 submission is waiting for review",
      titleMany: "{n} submissions are waiting for review",
      link: "/moderate",
      merge,
      count: n,
    });
  });
}

// After a review: keep today's "waiting" notice honest without making it
// unread again. When the queue is empty it says so and is marked read.
export async function refreshSubmissionsWaiting(admin: SupabaseClient): Promise<void> {
  await safe("admin_submissions", async () => {
    const n = await pendingCount(admin);
    const patch =
      n > 0
        ? { count: n, title: n === 1 ? "1 submission is waiting for review" : `${n} submissions are waiting for review` }
        : { title: "All submissions reviewed", read_at: new Date().toISOString() };
    const { error } = await admin.from("notifications").update(patch).eq("kind", "admin_submissions").eq("dedupe_key", `admin_submissions:${utcDay()}`);
    if (error && !isMissing(error.code)) console.error(`[notify:admin_submissions] ${error.message}`);
  });
}

export async function noticeNewReport(admin: SupabaseClient): Promise<void> {
  await safe("admin_reports", async () => {
    const { count } = await admin.from("content_reports").select("id", { count: "exact", head: true }).eq("status", "open");
    const n = Math.max(count ?? 1, 1);
    await notifyAdmins(admin, {
      kind: "admin_reports",
      key: `admin_reports:${utcDay()}`,
      title: "1 reported error to check",
      titleMany: "{n} reported errors to check",
      body: "Someone reported a problem with an item in the feed.",
      bodyMany: "People reported problems with items in the feed.",
      link: "/moderate/reports",
      merge: true,
      count: n,
    });
  });
}

// A daily job failed. The test alert gets its own key each time, so the
// "Send test alert" button always shows a notice.
export async function noticeJobFailed(admin: SupabaseClient, job: string, label: string, summary: string): Promise<void> {
  await safe("admin_job_failed", async () => {
    const key = job === "alert-test" ? `admin_job_failed:alert-test:${new Date().toISOString()}` : `admin_job_failed:${job}:${utcDay()}`;
    await notifyAdmins(admin, {
      kind: "admin_job_failed",
      key,
      title: `${label} failed`,
      titleMany: `${label} failed {n} times today`,
      body: snippet(summary, 280),
      link: "/moderate/admins",
      merge: true,
    });
  });
}

// ---------------------------------------------------------------------------
// Everyone: streak and collections.
// ---------------------------------------------------------------------------

export async function noticeStreakMilestone(admin: SupabaseClient, userId: string, days: number, title: string, line: string, day: string = utcDay()): Promise<void> {
  await safe("streak_milestone", async () => {
    await notify(admin, {
      users: [userId],
      kind: "streak_milestone",
      key: `streak_milestone:${day}`,
      title: title.replace(/\.$/, ""),
      body: `${line} That's a ${days}-day streak.`,
      link: "/profile",
    });
  });
}

// Announces a collection to everyone who has the switch on, once per
// collection ever, and at most one new collection per person per day.
export async function noticeNewCollection(admin: SupabaseClient, c: { id: string; title: string; blurb: string; emoji: string; tags: string[]; moods: string[] }): Promise<number> {
  let sent = 0;
  await safe("collection_new", async () => {
    const link = `/feed?collection=${c.id}`;
    const { data: before, error } = await admin.from("notifications").select("id").eq("link", link).limit(1);
    if (error || (before && before.length)) return; // already announced (or table missing)

    // Don't announce an empty collection: Explore hides those.
    let q = admin.from("content_items").select("id", { count: "exact", head: true }).eq("status", "approved");
    if (c.tags.length) q = q.in("tag", c.tags);
    if (c.moods.length) q = q.overlaps("moods", c.moods);
    const { count } = await q;
    if (!count) return;

    const users: string[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await admin.from("profiles").select("id").is("account_deleted_at", null).range(from, from + 999);
      users.push(...(data ?? []).map((r) => r.id as string));
      if (!data || data.length < 1000) break;
    }
    sent = await notify(admin, {
      users,
      kind: "collection_new",
      key: `collection_new:${utcDay()}`,
      title: `New collection: ${c.emoji} ${c.title}`.slice(0, 120),
      body: c.blurb || "Open it from Explore.",
      link,
    });
  });
  return sent;
}
