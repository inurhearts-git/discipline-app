import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MEANING_MAX_CHARS, draftAndStore, meaningConfigured, requireAdmin, type MeaningSource } from "@/lib/meaning";

export const maxDuration = 60;

// POST /api/admin/meanings/[id]   (admins only)
//   { action: "draft" }                         Claude writes a new draft (replaces any existing one)
//   { action: "save", text, approve: boolean }  save your edit, optionally approving it
//   { action: "unapprove" }                     hide it from readers again (keeps the text)
// DELETE removes the meaning entirely.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const adminId = await requireAdmin(supabase);
  if (!adminId) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const admin = createAdminClient();

  if (body.action === "draft") {
    if (!meaningConfigured()) return NextResponse.json({ error: "Add ANTHROPIC_API_KEY in Vercel to draft with Claude." }, { status: 503 });
    const { data: item } = await admin
      .from("content_items")
      .select("id, text, attributed_to, source, tag, type")
      .eq("id", params.id)
      .maybeSingle<MeaningSource & { type: string }>();
    if (!item || item.type === "video") return NextResponse.json({ error: "Item not found or is a video." }, { status: 404 });
    try {
      await draftAndStore(admin, item, { overwriteApproved: true });
    } catch (e) {
      return NextResponse.json({ error: `Claude couldn't draft it: ${e instanceof Error ? e.message : "unknown error"}` }, { status: 502 });
    }
  } else if (body.action === "save") {
    const text = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
    if (!text) return NextResponse.json({ error: "Write the meaning first." }, { status: 400 });
    if (text.length > MEANING_MAX_CHARS) return NextResponse.json({ error: `Keep it under ${MEANING_MAX_CHARS} characters.` }, { status: 400 });
    const { data: existing } = await admin.from("content_meanings").select("text, source").eq("content_id", params.id).maybeSingle<{ text: string; source: string }>();
    const source = !existing ? "human" : existing.text === text ? existing.source : existing.source === "human" ? "human" : "ai_edited";
    const approve = body.approve === true;
    const { error } = await admin.from("content_meanings").upsert(
      {
        content_id: params.id,
        text,
        source,
        status: approve ? "approved" : "draft",
        updated_at: new Date().toISOString(),
        approved_by: approve ? adminId : null,
        approved_at: approve ? new Date().toISOString() : null,
      },
      { onConflict: "content_id" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (body.action === "unapprove") {
    const { error } = await admin.from("content_meanings").update({ status: "draft", approved_by: null, approved_at: null }).eq("content_id", params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const { data: row } = await admin.from("content_meanings").select("text, status, source, updated_at").eq("content_id", params.id).maybeSingle();
  return NextResponse.json({ meaning: row });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  if (!(await requireAdmin(supabase))) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  const { error } = await createAdminClient().from("content_meanings").delete().eq("content_id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
