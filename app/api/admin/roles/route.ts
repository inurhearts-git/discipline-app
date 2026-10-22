import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLES, roleErrorMessage, type Role } from "@/lib/admins";

// Admin only. Changing roles goes through the server so the checks below
// always run; the database guard (migration 0015) also refuses to remove the
// last admin.
async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  if (user.app_metadata?.account_deleted === true) return { error: NextResponse.json({ error: "This account was deleted." }, { status: 403 }) };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return { error: NextResponse.json({ error: "Admin only" }, { status: 403 }) };
  return { userId: user.id };
}

// GET /api/admin/roles?email=person@example.com
// Finds one person by their exact sign-in email, so the admin can check the
// name before changing anything. No partial matches, no listing.
export async function GET(request: Request) {
  const who = await requireAdmin();
  if ("error" in who) return who.error;

  const email = new URL(request.url).searchParams.get("email")?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter their full email address." }, { status: 400 });

  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, display_name, email, role, account_deleted_at, onboarded")
    .ilike("email", email.replace(/[\\%_]/g, "\\$&")) // exact match, case-insensitive
    .maybeSingle();
  if (!data) return NextResponse.json({ error: "No account with that email." }, { status: 404 });
  if (data.account_deleted_at) return NextResponse.json({ error: "That account is deleted." }, { status: 409 });
  return NextResponse.json({ person: { id: data.id, display_name: data.display_name, email: data.email, role: data.role, onboarded: data.onboarded, isYou: data.id === who.userId } });
}

// POST /api/admin/roles  { userId, role: "viewer" | "creator" | "admin" }
export async function POST(request: Request) {
  const who = await requireAdmin();
  if ("error" in who) return who.error;

  const body = await request.json().catch(() => ({}));
  const userId = typeof body.userId === "string" ? body.userId : "";
  const role = body.role as Role;
  if (!userId || !ROLES.includes(role)) return NextResponse.json({ error: "Pick a person and a role." }, { status: 400 });
  if (userId === who.userId) return NextResponse.json({ error: "You can't change your own role. Ask another admin." }, { status: 400 });

  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("id, role, account_deleted_at").eq("id", userId).maybeSingle();
  if (!target) return NextResponse.json({ error: "No such account." }, { status: 404 });
  if (target.account_deleted_at) return NextResponse.json({ error: "That account is deleted." }, { status: 409 });
  if (target.role === role) return NextResponse.json({ ok: true, role });

  const { error } = await admin.from("profiles").update({ role }).eq("id", userId);
  if (error) return NextResponse.json({ error: roleErrorMessage(error.message) }, { status: error.message?.match(/last admin/i) ? 409 : 500 });
  return NextResponse.json({ ok: true, role });
}
