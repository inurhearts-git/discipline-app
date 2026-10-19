import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { archiveKey, open, restoreSnapshot, type Snapshot } from "@/lib/account-archive";

export const maxDuration = 30;

// POST /api/account/restore
// For a signed-in person whose account is flagged deleted: decrypt their
// archive, put everything back and clear the flag.
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (user.app_metadata?.account_deleted !== true) return NextResponse.json({ ok: true });

  const key = archiveKey();
  if (!key) return NextResponse.json({ error: "Restoring isn't set up on the server yet." }, { status: 503 });

  const admin = createAdminClient();
  const { data: archive } = await admin.from("account_archives").select("ciphertext, iv, tag, purge_after").eq("user_id", user.id).maybeSingle();
  if (!archive || new Date(archive.purge_after).getTime() < Date.now()) {
    return NextResponse.json({ error: "Your old details are no longer kept. You can start a new journey instead." }, { status: 410 });
  }

  try {
    const snapshot = JSON.parse(open(archive, key)) as Snapshot;
    await restoreSnapshot(admin, user.id, snapshot);
    await admin.from("account_archives").delete().eq("user_id", user.id);
    // app_metadata is merged, so null clears the flag that the middleware reads.
    await admin.auth.admin.updateUserById(user.id, { app_metadata: { account_deleted: null } });
  } catch {
    return NextResponse.json({ error: "Couldn't restore your account. Your details are still safe. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
