import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayStr } from "@/lib/constants";
import { ProfileClient } from "@/components/profile/ProfileClient";
import type { Profile } from "@/lib/database.types";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile) redirect("/login");

  const admin = createAdminClient();
  const { data: usage } = await admin
    .from("usage_sessions")
    .select("ms_spent")
    .eq("user_id", user.id)
    .eq("date", todayStr())
    .maybeSingle();

  let pendingCount = 0;
  if (profile.role === "admin") {
    const { count } = await supabase
      .from("content_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    pendingCount = count ?? 0;
  }

  return <ProfileClient profile={profile} usageMs={usage?.ms_spent ?? 0} pendingCount={pendingCount} />;
}
