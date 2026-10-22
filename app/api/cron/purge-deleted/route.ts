import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { purgeSummary, runPurge } from "@/lib/admins";

export const maxDuration = 60;

// Runs once a day (see vercel.json). Permanently erases accounts whose
// restore window has ended. Vercel sends "Authorization: Bearer <CRON_SECRET>".
// Anything that couldn't be erased returns status 500 with the reason, so the
// run shows as failed in Vercel's cron logs instead of passing quietly.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const report = await runPurge(createAdminClient());
  const summary = purgeSummary(report);
  const ok = !report.blocked && report.failed.length === 0;
  if (!ok) console.error(`[purge-deleted] ${summary}`);
  return NextResponse.json({ ...report, summary }, { status: ok ? 200 : 500 });
}
