import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminsClient } from "@/components/profile/AdminsClient";
import { erasureStatus, listAdmins } from "@/lib/admins";
import { alertEmailConfigured, jobHealth } from "@/lib/cron-monitor";

export const dynamic = "force-dynamic";

// Profile > Admins: who can moderate, adding or removing an admin, whether
// deleted accounts are being erased on time, and how the daily jobs are doing.
export default async function AdminsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") redirect("/feed");

  const admin = createAdminClient();
  const [admins, erasure, jobs] = await Promise.all([listAdmins(admin).catch(() => []), erasureStatus(admin), jobHealth(admin)]);
  return <AdminsClient admins={admins} meId={user.id} erasure={erasure} jobs={jobs} emailAlerts={alertEmailConfigured()} />;
}
