import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deletedAccountResponse, isDeletedAccount } from "@/lib/api-auth";

// POST /api/admin/reports/[id]  { action: "resolve" | "remove" }
//   resolve: close the report, keep the item live.
//   remove:  take the item out of the feed (status -> rejected) and close
//            every open report about it.
// Admin only; the role is read server-side.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isDeletedAccount(user)) return deletedAccountResponse();

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const action = body?.action;
  if (action !== "resolve" && action !== "remove") return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const admin = createAdminClient();
  const { data: report } = await admin.from("content_reports").select("id, content_id").eq("id", params.id).maybeSingle();
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const now = new Date().toISOString();
  const done = { status: "resolved", resolved_at: now, resolved_by: user.id };

  if (action === "remove") {
    const { error } = await admin.from("content_items").update({ status: "rejected" }).eq("id", report.content_id);
    if (error) return NextResponse.json({ error: "Couldn't remove the item." }, { status: 500 });
    await admin.from("content_reports").update(done).eq("content_id", report.content_id).eq("status", "open");
  } else {
    await admin.from("content_reports").update(done).eq("id", params.id);
  }
  return NextResponse.json({ ok: true });
}
