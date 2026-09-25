import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayStr } from "@/lib/constants";

// POST /api/usage/reset — zeroes today's usage for the current user.
// This is a development/testing convenience only (so you can exercise the
// cap without waiting an hour) and isn't part of blueprint §5 itself.
// Consider removing this route before shipping to real users.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("usage_sessions")
    .upsert({ user_id: user.id, date: todayStr(), ms_spent: 0 }, { onConflict: "user_id,date" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ msSpentToday: 0 });
}
