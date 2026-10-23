import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deletedAccountResponse, isDeletedAccount } from "@/lib/api-auth";
import { noticeNewReport } from "@/lib/notifications";

const REASONS = ["wrong_source", "inaccurate", "inappropriate", "broken_video", "other"] as const;
const DAILY_LIMIT = 20; // reports one person can send in 24 hours

// POST /api/report  { content_id, reason, note? }
// Any signed-in user can report an approved item. Reports are written with the
// service-role client (the table has no public policies).
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isDeletedAccount(user)) return deletedAccountResponse();

  const body = await request.json().catch(() => null);
  const contentId = typeof body?.content_id === "string" ? body.content_id : "";
  const reason = typeof body?.reason === "string" ? body.reason : "";
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 500) : "";
  if (!contentId || !(REASONS as readonly string[]).includes(reason)) {
    return NextResponse.json({ error: "Pick a reason." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: item } = await admin.from("content_items").select("id").eq("id", contentId).eq("status", "approved").maybeSingle();
  if (!item) return NextResponse.json({ error: "That item isn't available." }, { status: 404 });

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from("content_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json({ error: "You've sent a lot of reports today. Please try again tomorrow." }, { status: 429 });
  }

  // The same person reporting the same item again while it is still open adds nothing.
  const { data: existing } = await admin
    .from("content_reports")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("content_id", contentId)
    .eq("status", "open")
    .limit(1);
  if (existing && existing.length > 0) return NextResponse.json({ ok: true, duplicate: true });

  const { error } = await admin
    .from("content_reports")
    .insert({ content_id: contentId, reporter_id: user.id, reason, note: note || null });
  if (error) return NextResponse.json({ error: "Couldn't send your report. Please try again." }, { status: 500 });

  await noticeNewReport(admin); // admins' bell (backlog 8n)
  return NextResponse.json({ ok: true });
}
