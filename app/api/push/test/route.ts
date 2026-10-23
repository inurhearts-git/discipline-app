import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deletedAccountResponse, isDeletedAccount } from "@/lib/api-auth";
import { pushConfigured, sendPush } from "@/lib/push";

// POST /api/push/test: sends "Notifications are on" to the caller's own devices.
// At most once a minute.
const last = new Map<string, number>();

export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isDeletedAccount(user)) return deletedAccountResponse();
  if (!pushConfigured()) return NextResponse.json({ error: "Push isn't set up on the server yet." }, { status: 503 });
  if (Date.now() - (last.get(user.id) ?? 0) < 60_000) return NextResponse.json({ error: "Wait a minute before sending another test." }, { status: 429 });
  last.set(user.id, Date.now());

  const r = await sendPush(createAdminClient(), [user.id], {
    title: "Notifications are on",
    body: "This is how Discipline will reach you: a streak about to end, or a nudge after a few days away.",
    url: "/notifications",
    tag: "test",
  });
  if (!r.sent) return NextResponse.json({ error: "No device answered. Turn notifications off and on again." }, { status: 404 });
  return NextResponse.json({ ok: true, sent: r.sent });
}
