import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runRefill, type RefillResult } from "@/lib/auto-refill";
import { monitorCron } from "@/lib/cron-monitor";

export const maxDuration = 60;

// Stops that mean something is broken (not just "nothing to do today").
const BROKEN = /refused|couldn't save|no admin/i;

function refillSummary(r: RefillResult): string {
  const base = `Added ${r.added} of ${r.checked} new uploads from ${r.channels} channel${r.channels === 1 ? "" : "s"}.`;
  return [base, r.stopped ? `Stopped: ${r.stopped}` : "", r.errors ? `${r.errors} request${r.errors === 1 ? "" : "s"} failed.` : ""].filter(Boolean).join(" ");
}

// Runs once a day (see vercel.json). Vercel sends "Authorization: Bearer <CRON_SECRET>".
// Every run is recorded (migration 0016); a broken run returns 500 and sends
// an alert if email is set up.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  let result: RefillResult | null = null;
  const outcome = await monitorCron(admin, "refill", async () => {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key) return { ok: false, summary: "YOUTUBE_API_KEY is not set in Vercel." };
    result = await runRefill(admin, key);
    const broken = (result.stopped && BROKEN.test(result.stopped)) || (result.errors > 0 && result.added === 0 && result.checked === 0);
    return { ok: !broken, summary: refillSummary(result), details: result };
  });
  return NextResponse.json({ ...(result ?? {}), summary: outcome.summary }, { status: outcome.ok ? 200 : 500 });
}
