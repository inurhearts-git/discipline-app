import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deletedAccountResponse, isDeletedAccount } from "@/lib/api-auth";
import { MAX_BIRTHDAYS, daysInMonth, relationById } from "@/lib/birthdays";

const COLUMNS = "id, relation, pronoun, month, day";

async function signedIn() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  if (isDeletedAccount(user)) return { error: deletedAccountResponse() };
  return { supabase, user };
}

function missing(code?: string) {
  return code === "42P01" || code === "PGRST205";
}

// GET /api/birthdays: your list. Row-level security keeps it to your own rows.
export async function GET() {
  const s = await signedIn();
  if (s.error) return s.error;
  const { data, error } = await s.supabase.from("birthdays").select(COLUMNS).eq("user_id", s.user.id).order("month").order("day");
  if (error) return NextResponse.json({ error: missing(error.code) ? "Birthdays aren't switched on yet." : "Couldn't load birthdays." }, { status: 500 });
  return NextResponse.json({ birthdays: data ?? [] });
}

// POST /api/birthdays  { relation, pronoun?, month, day }   (no names, by design)
export async function POST(request: Request) {
  const s = await signedIn();
  if (s.error) return s.error;
  const body = await request.json().catch(() => null);
  const rel = relationById(typeof body?.relation === "string" ? body.relation : "");
  const month = Number(body?.month);
  const day = Number(body?.day);
  if (!rel) return NextResponse.json({ error: "Pick who it is." }, { status: 400 });
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(day) || day < 1 || day > daysInMonth(month)) {
    return NextResponse.json({ error: "Pick a real date." }, { status: 400 });
  }
  const pronoun = rel.pronoun ?? (body?.pronoun === "her" || body?.pronoun === "him" ? body.pronoun : "them");

  const { count } = await s.supabase.from("birthdays").select("id", { count: "exact", head: true }).eq("user_id", s.user.id);
  if ((count ?? 0) >= MAX_BIRTHDAYS) return NextResponse.json({ error: `You can keep up to ${MAX_BIRTHDAYS} birthdays.` }, { status: 400 });

  const { data, error } = await s.supabase.from("birthdays").insert({ user_id: s.user.id, relation: rel.id, pronoun, month, day }).select(COLUMNS).single();
  if (error) return NextResponse.json({ error: missing(error.code) ? "Birthdays aren't switched on yet." : "Couldn't save that. Try again." }, { status: 500 });
  return NextResponse.json({ birthday: data }, { status: 201 });
}

// DELETE /api/birthdays  { id }
export async function DELETE(request: Request) {
  const s = await signedIn();
  if (s.error) return s.error;
  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { error } = await s.supabase.from("birthdays").delete().eq("id", id).eq("user_id", s.user.id);
  if (error) return NextResponse.json({ error: "Couldn't remove that. Try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
