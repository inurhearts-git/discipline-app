import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deletedAccountResponse, isDeletedAccount } from "@/lib/api-auth";

const MAX_DEVICES = 10; // per person; the oldest is dropped beyond this

function clean(body: any): { endpoint: string; p256dh: string; auth: string } | null {
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body?.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body?.keys?.auth === "string" ? body.keys.auth : "";
  if (!/^https:\/\/[^\s]+$/.test(endpoint) || endpoint.length > 1000) return null;
  if (!/^[A-Za-z0-9_\-=]{20,200}$/.test(p256dh) || !/^[A-Za-z0-9_\-=]{8,100}$/.test(auth)) return null;
  return { endpoint, p256dh, auth };
}

async function signedIn() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  if (isDeletedAccount(user)) return { error: deletedAccountResponse() };
  return { user };
}

// POST /api/push/subscribe  (the browser's PushSubscription as JSON)
// Saves this device for the signed-in person. If the device was saved for
// someone else (a shared browser), it moves to the current person.
export async function POST(request: Request) {
  const s = await signedIn();
  if (s.error) return s.error;
  const sub = clean(await request.json().catch(() => null));
  if (!sub) return NextResponse.json({ error: "That doesn't look like a push subscription." }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("push_subscriptions")
    .upsert({ user_id: s.user.id, ...sub, user_agent: (request.headers.get("user-agent") ?? "").slice(0, 300) || null }, { onConflict: "endpoint" });
  if (error) return NextResponse.json({ error: "Couldn't turn notifications on. Try again." }, { status: 500 });

  const { data: mine } = await admin.from("push_subscriptions").select("id").eq("user_id", s.user.id).order("created_at", { ascending: false });
  const extra = (mine ?? []).slice(MAX_DEVICES).map((r) => r.id as string);
  if (extra.length) await admin.from("push_subscriptions").delete().in("id", extra);
  return NextResponse.json({ ok: true });
}

// DELETE /api/push/subscribe  { endpoint }
// Forgets this device (turning push off, or signing out).
export async function DELETE(request: Request) {
  const s = await signedIn();
  if (s.error) return s.error;
  const body = await request.json().catch(() => null);
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  await createAdminClient().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", s.user.id);
  return NextResponse.json({ ok: true });
}
