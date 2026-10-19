import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// POST /api/admin/refill/toggle  { person_id, enabled }: switch a channel on or off. Admin only.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const personId = typeof body?.person_id === "string" ? body.person_id : "";
  if (!personId || typeof body?.enabled !== "boolean") return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: person } = await admin.from("people").select("youtube_channel_id").eq("id", personId).maybeSingle();
  if (!person) return NextResponse.json({ error: "Person not found" }, { status: 404 });
  if (body.enabled && !/^UC[\w-]{20,}$/.test(person.youtube_channel_id ?? "")) {
    return NextResponse.json({ error: "This speaker has no YouTube channel saved." }, { status: 400 });
  }

  // Switching on starts fresh: only uploads from the newest few onward are considered.
  const patch: Record<string, unknown> = { auto_refill: body.enabled };
  if (body.enabled) patch.refill_since = null;
  const { error } = await admin.from("people").update(patch).eq("id", personId);
  if (error) return NextResponse.json({ error: "Couldn't save that. Try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
