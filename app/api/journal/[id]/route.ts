import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkBody, cleanBody, type JournalEntry } from "@/lib/journal";
import { deletedAccountResponse, isDeletedAccount } from "@/lib/api-auth";

// PATCH /api/journal/[id]  { body: string }  edits an entry (keeps its original time stamp).
// DELETE /api/journal/[id] removes it. RLS limits both to the owner's entries.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isDeletedAccount(user)) return deletedAccountResponse();

  const payload = await request.json().catch(() => ({}));
  const body = cleanBody(typeof payload.body === "string" ? payload.body : "");
  const problem = checkBody(body);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const { data, error } = await supabase
    .from("journal_entries")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .eq("user_id", user.id)
    .select("id, body, created_at, updated_at")
    .maybeSingle<JournalEntry>();

  if (error) return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isDeletedAccount(user)) return deletedAccountResponse();

  const { error } = await supabase.from("journal_entries").delete().eq("id", params.id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "Couldn't delete. Try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
