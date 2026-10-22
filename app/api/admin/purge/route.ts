import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { purgeSummary, runPurge } from "@/lib/admins";
import { deletedAccountResponse, isDeletedAccount } from "@/lib/api-auth";

export const maxDuration = 60;

// POST /api/admin/purge: the "Run erasure now" button on the Admins page.
// Same work as the daily cron, with the report shown to the admin.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isDeletedAccount(user)) return deletedAccountResponse();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const report = await runPurge(createAdminClient());
  return NextResponse.json({ ...report, summary: purgeSummary(report) });
}
