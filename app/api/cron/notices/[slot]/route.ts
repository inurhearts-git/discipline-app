import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { monitorCron } from "@/lib/cron-monitor";
import { runNoticesJob } from "@/lib/notices-job";

export const maxDuration = 60;

// The notices job (backlog 8n): streak-at-risk reminders, the once-a-day
// admin checks, and clearing old notices.
//
// vercel.json lists it once for every hour (/api/cron/notices/00 ... /23).
// Each of those is a once-a-day job, which every Vercel plan allows; together
// they run every hour, so the reminder reaches everyone about 3 hours before
// their own midnight. The slot in the path is only a label. Vercel sends
// "Authorization: Bearer <CRON_SECRET>". Every run is recorded (migration
// 0016) under "notices".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const outcome = await monitorCron(admin, "notices", () => runNoticesJob(admin));
  return NextResponse.json({ summary: outcome.summary, details: outcome.details ?? null }, { status: outcome.ok ? 200 : 500 });
}
