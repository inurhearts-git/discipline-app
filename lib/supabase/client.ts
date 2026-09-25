import { createBrowserClient } from "@supabase/ssr";

// Used from Client Components ("use client"). Reads the public anon key —
// safe to ship to the browser. All access is still gated by RLS policies
// defined in supabase/migrations/0001_init.sql.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
