import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isMoodId } from "@/lib/moods";
import { draftAndStore, meaningConfigured } from "@/lib/meaning";

// Leaves time for the Claude draft made on approval.
export const maxDuration = 30;

// POST /api/moderate/[id]
//   { action: "approve" | "reject",
//     maturity_rating?: "general" | "mature",
//     moods?: string[] }
//
// This is the fix for the prototype's biggest gap: approval used to be a
// plain client-side write to shared storage, trustworthy for a demo but
// not for production. Here the route independently verifies the caller's
// role by reading profiles.role server-side (never trusting a client-sent
// role claim), and only then uses the service-role client to update
// content_items — there is no client-side update policy on content_items
// at all (see migration), so this server check is the only path.
//
// Blueprint §6: on approve, maturity_rating can be confirmed or overridden
// by the admin here — if omitted, the submitter's original rating stands.
// Moods work the same way: if `moods` is omitted, the submitter's tags
// stand; if provided (even as an empty array), the admin's list replaces them.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action === "reject" ? "rejected" : body.action === "approve" ? "approved" : null;
  if (!action) return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });

  const update: Record<string, unknown> = { status: action, reviewed_by: user.id };
  if (action === "approved" && (body.maturity_rating === "general" || body.maturity_rating === "mature")) {
    update.maturity_rating = body.maturity_rating;
  }
  // Video captions (often a raw YouTube title) can be tidied at approval.
  if (action === "approved" && typeof body.text === "string") {
    const text = body.text.trim();
    if (text.length > 0 && text.length <= 300) update.text = text;
  }
  if (action === "approved" && Array.isArray(body.moods)) {
    // Only accept known moods, de-duplicated.
    update.moods = Array.from(
      new Set(body.moods.filter((m: unknown): m is string => typeof m === "string" && isMoodId(m)))
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from("content_items").update(update).eq("id", params.id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Approved quotes and scripture get a draft meaning from Claude, ready for
  // review in /moderate/meanings. A failure here never blocks the approval.
  let meaningDrafted = false;
  if (action === "approved" && data && data.type !== "video" && meaningConfigured()) {
    try {
      const r = await draftAndStore(admin, data);
      meaningDrafted = !r.skipped;
    } catch (e) {
      console.error("[moderate] meaning draft failed", params.id, e instanceof Error ? e.message : e);
    }
  }
  return NextResponse.json({ item: data, meaningDrafted });
}
