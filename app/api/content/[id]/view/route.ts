import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/content/[id]/view
// Records a view for the current user on this content item, deduped
// server-side per user per day (see record_view in
// supabase/migrations/0002_view_counter.sql). No body needed -- the content
// id comes from the URL and the user comes from the session, so there's
// nothing here a client could tamper with to inflate the count.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { error } = await supabase.rpc("record_view", { p_content_id: params.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}