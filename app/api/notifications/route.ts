import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deletedAccountResponse, isDeletedAccount } from "@/lib/api-auth";
import { isMissing } from "@/lib/notifications";
import { safeZone } from "@/lib/notices-job";

const NO_STORE = { "Cache-Control": "no-store" };

export interface NoticeRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  count: number;
  created_at: string;
  read_at: string | null;
}

// GET /api/notifications             newest first (up to 100) and the unread count
// GET /api/notifications?count=1     just the unread count (the bell polls this)
//     &tz=Asia/Dubai                 the device's time zone, saved for the
//                                    "streak at risk" reminder when it changes
// Reads go through the signed-in client, so row-level security limits them to
// the caller's own notices.
export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isDeletedAccount(user)) return deletedAccountResponse();

  const url = new URL(request.url);
  const tz = url.searchParams.get("tz");
  if (tz) await saveTimeZone(supabase, user.id, tz);

  const unreadQ = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("read_at", null);
  if (unreadQ.error) {
    // Before migration 0017: an empty bell, not an error.
    if (isMissing(unreadQ.error.code)) return NextResponse.json({ unread: 0, items: [], ready: false }, { headers: NO_STORE });
    return NextResponse.json({ error: "Couldn't load notices." }, { status: 500 });
  }
  const unread = unreadQ.count ?? 0;
  if (url.searchParams.get("count")) return NextResponse.json({ unread }, { headers: NO_STORE });

  const { data, error } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, count, created_at, read_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: "Couldn't load notices." }, { status: 500 });
  return NextResponse.json({ unread, items: (data ?? []) as NoticeRow[], ready: true }, { headers: NO_STORE });
}

// Writes the time zone only when it differs from what's stored.
async function saveTimeZone(supabase: ReturnType<typeof createClient>, userId: string, raw: string): Promise<void> {
  const tz = raw.slice(0, 64);
  if (safeZone(tz) !== tz) return; // not a real zone name
  const { data, error } = await supabase.from("notification_settings").select("time_zone").eq("user_id", userId).maybeSingle();
  if (error || data?.time_zone === tz) return;
  await createAdminClient()
    .from("notification_settings")
    .upsert({ user_id: userId, time_zone: tz, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
}
