// Server side of lib/day.ts: which time zone this request's "today" uses.
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TZ_COOKIE, dayIn, safeZone } from "@/lib/day";

// The zone the browser reported (cookie), else the one saved with the
// person's notice settings, else UTC.
export async function userZone(supabase: SupabaseClient, userId: string): Promise<string> {
  const fromCookie = cookies().get(TZ_COOKIE)?.value;
  if (fromCookie) {
    const tz = safeZone(decodeURIComponent(fromCookie));
    if (tz !== "UTC" || fromCookie === "UTC") return tz;
  }
  const { data } = await supabase.from("notification_settings").select("time_zone").eq("user_id", userId).maybeSingle();
  return safeZone((data?.time_zone as string | null) ?? null);
}

// This person's calendar date right now.
export async function userToday(supabase: SupabaseClient, userId: string): Promise<{ tz: string; today: string }> {
  const tz = await userZone(supabase, userId);
  return { tz, today: dayIn(tz) };
}
