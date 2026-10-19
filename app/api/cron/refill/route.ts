import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runRefill } from "@/lib/auto-refill";

export const maxDuration = 60;

// Runs once a day (see vercel.json). Vercel sends "Authorization: Bearer <CRON_SECRET>".
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return NextResponse.json({ error: "YOUTUBE_API_KEY is not set" }, { status: 503 });

  const result = await runRefill(createAdminClient(), key);
  return NextResponse.json(result);
}
