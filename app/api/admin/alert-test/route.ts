import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/meaning";
import { createClient } from "@/lib/supabase/server";
import { monitorCron } from "@/lib/cron-monitor";

// POST /api/admin/alert-test: the "Send test alert" button on the Admins page.
// Runs a job that fails on purpose, so it is recorded and alerted exactly
// like a real failed cron. Admin only.
export async function POST() {
  if (!(await requireAdmin(createClient()))) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const out = await monitorCron(createAdminClient(), "alert-test", async () => {
    throw new Error("Test alert from the Admins page. If you can read this, failed jobs will reach you.");
  });
  return NextResponse.json({ recorded: out.recorded, alert: out.alert });
}
