import type { SupabaseClient } from "@supabase/supabase-js";

// One-line daily reflection (migration 0007).
export const REFLECTION_MAX = 280;

// Today's reflection text for this user, or "" when there isn't one (or the
// table doesn't exist yet, so pages keep working before the migration is run).
// `today` is the person's own date (userToday() in lib/day-server.ts).
export async function getTodayReflection(supabase: SupabaseClient, userId: string, today: string): Promise<string> {
  const { data, error } = await supabase
    .from("reflections")
    .select("text")
    .eq("user_id", userId)
    .eq("date", today)
    .maybeSingle<{ text: string }>();
  if (error) return "";
  return data?.text ?? "";
}
