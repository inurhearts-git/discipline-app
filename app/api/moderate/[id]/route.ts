import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/moderate/[id]  { action: "approve" | "reject" }
//
// This is the fix for the prototype's biggest gap: approval used to be a
// plain client-side write to shared storage, trustworthy for a demo but
// not for production. Here the route independently verifies the caller's
// role by reading profiles.role server-side (never trusting a client-sent
// role claim), and only then uses the service-role client to update
// content_items — there is no client-side update policy on content_items
// at all (see migration), so this server check is the only path.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action === "reject" ? "rejected" : body.action === "approve" ? "approved" : null;
  if (!action) return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("content_items")
    .update({ status: action, reviewed_by: user.id })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
