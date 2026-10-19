import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { purgeAccount } from "@/lib/account-archive";

export const maxDuration = 60;

// Runs once a day (see vercel.json). Permanently erases accounts whose
// restore window has ended. Vercel sends "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: due } = await admin
    .from("account_archives")
    .select("user_id")
    .lt("purge_after", new Date().toISOString())
    .order("purge_after", { ascending: true })
    .limit(50);

  let purged = 0;
  let failed = 0;
  for (const row of due ?? []) {
    try {
      await purgeAccount(admin, row.user_id as string);
      purged++;
    } catch {
      failed++;
    }
  }
  return NextResponse.json({ purged, failed });
}
