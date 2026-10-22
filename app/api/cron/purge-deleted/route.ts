import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { purgeSummary, runPurge, type PurgeReport } from "@/lib/admins";
import { monitorCron } from "@/lib/cron-monitor";

export const maxDuration = 60;

// Runs once a day (see vercel.json). Permanently erases accounts whose
// restore window has ended. Vercel sends "Authorization: Bearer <CRON_SECRET>".
// Every run is recorded (migration 0016). Anything that couldn't be erased
// returns status 500 with the reason and sends an alert if email is set up.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  let report: PurgeReport | null = null;
  const outcome = await monitorCron(admin, "purge-deleted", async () => {
    report = await runPurge(admin);
    return { ok: !report.blocked && report.failed.length === 0, summary: purgeSummary(report), details: report };
  });
  return NextResponse.json({ ...(report ?? {}), summary: outcome.summary }, { status: outcome.ok ? 200 : 500 });
}
