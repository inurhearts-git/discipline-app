import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { todayStr } from "@/lib/constants";
import { REFLECTION_MAX } from "@/lib/reflection";

// PUT /api/reflection  { text: string, contentId?: string | null }
// Saves (or replaces) today's one-line reflection for the current user.
// DELETE /api/reflection removes today's. RLS (migration 0007) limits every
// row to its owner, so the user-scoped client is enough.
export async function PUT(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
  if (!text) return NextResponse.json({ error: "Write something first." }, { status: 400 });
  if (text.length > REFLECTION_MAX) return NextResponse.json({ error: `Keep it under ${REFLECTION_MAX} characters.` }, { status: 400 });
  const contentId = typeof body.contentId === "string" && body.contentId ? body.contentId : null;

  const { data, error } = await supabase
    .from("reflections")
    .upsert(
      { user_id: user.id, date: todayStr(), text, content_id: contentId, updated_at: new Date().toISOString() },
      { onConflict: "user_id,date" }
    )
    .select("text, date")
    .single<{ text: string; date: string }>();

  if (error) {
    const missing = error.code === "42P01" || /reflections/.test(error.message ?? "");
    return NextResponse.json(
      { error: missing ? "Reflections aren't set up yet (run migration 0007)." : "Couldn't save. Try again." },
      { status: 500 }
    );
  }
  return NextResponse.json(data);
}

export async function DELETE() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { error } = await supabase.from("reflections").delete().eq("user_id", user.id).eq("date", todayStr());
  if (error) return NextResponse.json({ error: "Couldn't delete. Try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
