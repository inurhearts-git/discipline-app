import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { RefillClient, type RefillPerson } from "@/components/profile/RefillClient";
import { DAILY_QUOTA_UNITS, getUnitsUsed } from "@/lib/youtube-quota";
import { PENDING_CAP } from "@/lib/auto-refill";

export const dynamic = "force-dynamic";

export default async function RefillPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") redirect("/feed");

  const admin = createAdminClient();
  const { data: people } = await admin
    .from("people")
    .select("id, name, youtube_channel_id, auto_refill, refill_last_run_at, refill_last_added")
    .order("name", { ascending: true })
    .limit(500);
  const { count: pending } = await admin.from("content_items").select("id", { count: "exact", head: true }).eq("status", "pending");
  const used = await getUnitsUsed(admin);

  const rows: RefillPerson[] = (people ?? []).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    hasChannel: /^UC[\w-]{20,}$/.test((p.youtube_channel_id as string | null) ?? ""),
    enabled: !!p.auto_refill,
    lastRunAt: (p.refill_last_run_at as string | null) ?? null,
    lastAdded: (p.refill_last_added as number | null) ?? null,
  }));

  return <RefillClient people={rows} pending={pending ?? 0} pendingCap={PENDING_CAP} unitsLeft={used === null ? null : Math.max(0, DAILY_QUOTA_UNITS - used)} />;
}
