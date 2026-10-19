import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { WelcomeBackClient } from "./WelcomeBackClient";

export const dynamic = "force-dynamic";

// Shown to someone who deleted their account and has now signed in again with
// the same email: pick up where they left off, or start a new journey.
export default async function WelcomeBackPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (user.app_metadata?.account_deleted !== true) redirect("/feed");

  const admin = createAdminClient();
  const { data: archive } = await admin.from("account_archives").select("purge_after").eq("user_id", user.id).maybeSingle();

  let daysLeft: number | null = null;
  if (archive) {
    const ms = new Date(archive.purge_after).getTime() - Date.now();
    if (ms > 0) daysLeft = Math.max(1, Math.ceil(ms / (24 * 60 * 60 * 1000)));
  }

  return <WelcomeBackClient email={user.email ?? ""} daysLeft={daysLeft} />;
}
