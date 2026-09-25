import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ModerateClient } from "@/components/profile/ModerateClient";
import type { ContentItem } from "@/lib/database.types";

export default async function ModeratePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  // Server-side gate, not just a hidden UI link — RLS also independently
  // restricts which rows come back below, so this redirect is a UX nicety
  // on top of an already-enforced boundary.
  if (!profile || profile.role !== "admin") redirect("/feed");

  const { data: pending } = await supabase
    .from("content_items")
    .select("id, tag, text, attributed_to, source, type, video_id, submitted_by, submitted_by_profile:profiles!content_items_submitted_by_fkey(display_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return <ModerateClient initialPending={(pending as unknown as ContentItem[]) ?? []} />;
}
