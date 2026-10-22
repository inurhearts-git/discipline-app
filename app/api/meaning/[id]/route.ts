import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deletedAccountResponse, isDeletedAccount } from "@/lib/api-auth";

// GET /api/meaning/[id] -> { text } for an approved meaning (RLS hides drafts).
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isDeletedAccount(user)) return deletedAccountResponse();

  const { data } = await supabase
    .from("content_meanings")
    .select("text")
    .eq("content_id", params.id)
    .eq("status", "approved")
    .maybeSingle<{ text: string }>();
  if (!data) return NextResponse.json({ error: "No meaning yet" }, { status: 404 });
  return NextResponse.json({ text: data.text }, { headers: { "Cache-Control": "private, max-age=300" } });
}
