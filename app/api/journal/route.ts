import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkBody, cleanBody, type JournalEntry } from "@/lib/journal";
import { deletedAccountResponse, isDeletedAccount } from "@/lib/api-auth";

// POST /api/journal  { body: string }
// Creates a journal entry for the current user, stamped with the current date
// and time. RLS (migration 0008) keeps every entry private to its owner.
export async function POST(request: Request) {
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
    .insert({ user_id: user.id, body })
    .select("id, body, created_at, updated_at")
    .single<JournalEntry>();

  if (error) {
    const missing = error.code === "42P01" || /journal_entries/.test(error.message ?? "");
    return NextResponse.json(
      { error: missing ? "The journal isn't set up yet (run migration 0008)." : "Couldn't save. Try again." },
      { status: 500 }
    );
  }
  return NextResponse.json(data);
}
