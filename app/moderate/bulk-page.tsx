import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BulkAddClient } from "@/components/profile/BulkAddClient";

export default async function BulkAddPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  // Same server-side gate as the moderation page. The API route checks the role again.
  if (!profile || profile.role !== "admin") redirect("/feed");

  return <BulkAddClient />;
}
