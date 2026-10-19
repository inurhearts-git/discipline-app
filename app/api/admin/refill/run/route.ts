import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runRefill } from "@/lib/auto-refill";

export const maxDuration = 60;

// POST /api/admin/refill/run: the "Run now" button. Admin only.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return NextResponse.json({ error: "YouTube isn't configured on the server yet." }, { status: 503 });

  const result = await runRefill(createAdminClient(), key);
  return NextResponse.json(result);
}
