import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminsClient } from "@/components/profile/AdminsClient";
import { erasureStatus, listAdmins } from "@/lib/admins";

export const dynamic = "force-dynamic";

// Profile > Admins: who can moderate, adding or removing an admin, and whether
// deleted accounts are being erased on time.
export default async function AdminsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") redirect("/feed");

  const admin = createAdminClient();
  const [admins, erasure] = await Promise.all([listAdmins(admin).catch(() => []), erasureStatus(admin)]);
  return <AdminsClient admins={admins} meId={user.id} erasure={erasure} />;
}
