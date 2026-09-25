import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// DANGER: bypasses Row Level Security entirely. Never import this into
// anything that ships to the browser, and never call it before the calling
// route has independently verified who the user is and what they're allowed
// to do (see app/api/usage/heartbeat and app/api/moderate/[id]).
//
// This is what makes §5 (server-side usage cap) and moderation actually
// authoritative instead of client-trusted: the client can't write these
// rows directly (no RLS policy grants it), only this server-side client can.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
