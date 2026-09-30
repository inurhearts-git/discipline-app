import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/usage/history?days=7
// Returns the user's own usage_sessions rows for the last N days, with
// missing days filled in as 0. RLS already restricts usage_sessions reads
// to "your own row" (see 0001_init.sql), so no extra check is needed here
// beyond being signed in.
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const days = Math.min(30, Math.max(1, Number(searchParams.get("days")) || 7));

  const dateList: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dateList.push(d.toISOString().slice(0, 10));
  }

  const { data, error } = await supabase
    .from("usage_sessions")
    .select("date, ms_spent")
    .eq("user_id", user.id)
    .gte("date", dateList[0]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byDate = new Map((data ?? []).map((row) => [row.date, row.ms_spent]));
  const history = dateList.map((date) => ({ date, msSpent: byDate.get(date) ?? 0 }));

  return NextResponse.json({ history });
}