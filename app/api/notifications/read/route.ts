import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deletedAccountResponse, isDeletedAccount } from "@/lib/api-auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/notifications/read  { id }  or  { all: true }
// Marks the caller's own notices read. Uses the signed-in client: row-level
// security only lets a person touch their own rows, and only read_at.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isDeletedAccount(user)) return deletedAccountResponse();

  const body = await request.json().catch(() => null);
  const all = body?.all === true;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!all && !UUID.test(id)) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  let q = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (!all) q = q.eq("id", id);
  const { error } = await q;
  if (error) return NextResponse.json({ error: "Couldn't update that. Try again." }, { status: 500 });

  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null);
  return NextResponse.json({ ok: true, unread: count ?? 0 });
}
