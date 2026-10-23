import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deletedAccountResponse, isDeletedAccount } from "@/lib/api-auth";
import { DEFAULT_SETTINGS, NOTICE_SETTINGS, isMissing, type NoticeSettings } from "@/lib/notifications";

// PATCH /api/notifications/settings  { streak?, collections?, submissions?, comeback? }
// Switches a kind of notice on or off for the caller. Switching a kind off
// stops new notices of that kind; ones already under the bell stay.
export async function PATCH(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (isDeletedAccount(user)) return deletedAccountResponse();

  const body = await request.json().catch(() => null);
  const patch: Partial<NoticeSettings> = {};
  for (const s of NOTICE_SETTINGS) if (typeof body?.[s.id] === "boolean") patch[s.id] = body[s.id];
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const { data, error } = await createAdminClient()
    .from("notification_settings")
    .upsert({ user_id: user.id, ...patch, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
    .select("*")
    .single();
  if (error) {
    const msg = isMissing(error.code) ? "Notices aren't switched on yet (migration 0017)." : "Couldn't save that. Try again.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  const settings = { ...DEFAULT_SETTINGS };
  for (const s of NOTICE_SETTINGS) if (typeof data?.[s.id] === "boolean") settings[s.id] = data[s.id];
  return NextResponse.json({ settings });
}
