import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deletedAccountResponse, isDeletedAccount } from "@/lib/api-auth";

// POST /api/content/[id]/interact  { kind: "liked" | "saved" }
// Toggles the given flag for the current user on this content item.
// RLS restricts user_content_interactions to rows where user_id = self,
// so this is safe even without an extra check.
//
// Also records WHEN it was liked or saved (liked_at / saved_at, migration
// 0006) for the limit-screen recap, and clears the time when it is toggled
// off. If that migration hasn't been run yet, the write is retried without
// the timestamp so liking and saving keep working.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isDeletedAccount(user)) return deletedAccountResponse();

  const body = await request.json().catch(() => ({}));
  const kind = body.kind === "saved" ? "saved" : "liked";

  const { data: existing } = await supabase
    .from("user_content_interactions")
    .select("liked, saved")
    .eq("user_id", user.id)
    .eq("content_id", params.id)
    .maybeSingle();

  const nextValue = !(existing?.[kind as "liked" | "saved"] ?? false);

  const row = {
    user_id: user.id,
    content_id: params.id,
    liked: kind === "liked" ? nextValue : existing?.liked ?? false,
    saved: kind === "saved" ? nextValue : existing?.saved ?? false,
  };
  const when = nextValue ? new Date().toISOString() : null;
  const timestamp = kind === "liked" ? { liked_at: when } : { saved_at: when };

  let { error } = await supabase
    .from("user_content_interactions")
    .upsert({ ...row, ...timestamp }, { onConflict: "user_id,content_id" });

  // Column missing (migration 0006 not run yet): save without the timestamp.
  if (error && (error.code === "PGRST204" || /liked_at|saved_at/.test(error.message))) {
    ({ error } = await supabase
      .from("user_content_interactions")
      .upsert(row, { onConflict: "user_id,content_id" }));
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ [kind]: nextValue });
}
