import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { draftAndStore, meaningConfigured, requireAdmin, type MeaningSource } from "@/lib/meaning";

export const maxDuration = 60;

const PER_CALL = 8; // small batches so each request finishes well inside the time limit
const PARALLEL = 4;

// POST /api/admin/meanings/batch  (admins only)
// Drafts meanings for up to 8 approved quotes/scripture that have none yet.
// The review page calls it repeatedly until `remaining` is 0.
export async function POST() {
  const supabase = createClient();
  if (!(await requireAdmin(supabase))) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  if (!meaningConfigured()) return NextResponse.json({ error: "Add ANTHROPIC_API_KEY in Vercel to draft with Claude." }, { status: 503 });

  const admin = createAdminClient();
  const [{ data: items }, { data: have }] = await Promise.all([
    admin.from("content_items").select("id, text, attributed_to, source, tag").eq("status", "approved").neq("type", "video").order("created_at").limit(5000).returns<MeaningSource[]>(),
    admin.from("content_meanings").select("content_id").limit(10000).returns<{ content_id: string }[]>(),
  ]);
  const done = new Set((have ?? []).map((r) => r.content_id));
  const missing = (items ?? []).filter((i) => !done.has(i.id) && i.text?.trim());
  const todo = missing.slice(0, PER_CALL);

  let drafted = 0;
  const failures: string[] = [];
  for (let i = 0; i < todo.length; i += PARALLEL) {
    const results = await Promise.allSettled(todo.slice(i, i + PARALLEL).map((item) => draftAndStore(admin, item)));
    results.forEach((r, k) => {
      if (r.status === "fulfilled") drafted += 1;
      else failures.push(`${todo[i + k].id}: ${r.reason instanceof Error ? r.reason.message : "error"}`);
    });
  }
  if (failures.length) console.error("[meanings batch]", failures);
  return NextResponse.json({ drafted, failed: failures.length, remaining: Math.max(0, missing.length - drafted - failures.length), firstError: failures[0] ?? null });
}
