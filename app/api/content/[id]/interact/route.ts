import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/content/[id]/interact  { kind: "liked" | "saved" }
// Toggles the given flag for the current user on this content item.
// RLS restricts user_content_interactions to rows where user_id = self,
// so this is safe even without an extra check.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const kind = body.kind === "saved" ? "saved" : "liked";

  const { data: existing } = await supabase
    .from("user_content_interactions")
    .select("liked, saved")
    .eq("user_id", user.id)
    .eq("content_id", params.id)
    .maybeSingle();

  const nextValue = !(existing?.[kind as "liked" | "saved"] ?? false);

  const { error } = await supabase.from("user_content_interactions").upsert(
    {
      user_id: user.id,
      content_id: params.id,
      liked: kind === "liked" ? nextValue : existing?.liked ?? false,
      saved: kind === "saved" ? nextValue : existing?.saved ?? false,
    },
    { onConflict: "user_id,content_id" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ [kind]: nextValue });
}
