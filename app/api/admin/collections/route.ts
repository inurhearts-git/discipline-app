import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseCollectionInput } from "@/lib/collections";
import { deletedAccountResponse, isDeletedAccount } from "@/lib/api-auth";
import { noticeNewCollection } from "@/lib/notifications";

async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isDeletedAccount(user)) return deletedAccountResponse();
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  return null;
}

// POST /api/admin/collections: create. PATCH { id, ... }: update. DELETE { id }: remove. Admin only.
// A new active collection, or one switched from hidden to active, is announced
// under everyone's bell (backlog 8n): once per collection, only if it has items.
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const parsed = parseCollectionInput(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin.from("collections").insert(parsed.value).select("id").single();
  if (error) return NextResponse.json({ error: "Couldn't save that. Is migration 0014 run?" }, { status: 500 });
  const announced = parsed.value.is_active ? await noticeNewCollection(admin, { id: data.id, ...parsed.value }) : 0;
  return NextResponse.json({ id: data.id, announced });
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const parsed = parseCollectionInput(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const admin = createAdminClient();
  const { data: before } = await admin.from("collections").select("is_active").eq("id", id).maybeSingle();
  const { error } = await admin.from("collections").update(parsed.value).eq("id", id);
  if (error) return NextResponse.json({ error: "Couldn't save that. Try again." }, { status: 500 });
  const switchedOn = before?.is_active === false && parsed.value.is_active;
  const announced = switchedOn ? await noticeNewCollection(admin, { id, ...parsed.value }) : 0;
  return NextResponse.json({ ok: true, announced });
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { error } = await createAdminClient().from("collections").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Couldn't delete that. Try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
