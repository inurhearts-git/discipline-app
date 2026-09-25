import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DAILY_LIMIT_MS, MAX_HEARTBEAT_DELTA_MS, todayStr } from "@/lib/constants";

// POST /api/usage/heartbeat  { deltaMs: number }
//
// This is blueprint §5: the client sends a heartbeat every ~15s while the
// feed is in view. The server is the sole source of truth for how much
// time has been spent — deltaMs is clamped so a client can't send an
// inflated value to fast-forward past the cap, and the row is written with
// the service-role client so no client-side write policy could be abused
// to the same end (see supabase/migrations/0001_init.sql — there is no
// authenticated insert/update policy on usage_sessions at all).
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const rawDelta = typeof body.deltaMs === "number" ? body.deltaMs : 0;
  const deltaMs = Math.max(0, Math.min(rawDelta, MAX_HEARTBEAT_DELTA_MS));

  const admin = createAdminClient();
  const date = todayStr();

  const { data: existing } = await admin
    .from("usage_sessions")
    .select("ms_spent")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  const msSpentToday = (existing?.ms_spent ?? 0) + deltaMs;

  const { error: upsertError } = await admin
    .from("usage_sessions")
    .upsert({ user_id: user.id, date, ms_spent: msSpentToday }, { onConflict: "user_id,date" });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ msSpentToday, limitMs: DAILY_LIMIT_MS });
}

// GET /api/usage/heartbeat — read today's usage without adding time.
// Used on feed-page load to know whether to show the feed or the limit
// screen before the first heartbeat has fired.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const date = todayStr();

  const { data } = await admin
    .from("usage_sessions")
    .select("ms_spent")
    .eq("user_id", user.id)
    .eq("date", date)
    .maybeSingle();

  return NextResponse.json({ msSpentToday: data?.ms_spent ?? 0, limitMs: DAILY_LIMIT_MS });
}
