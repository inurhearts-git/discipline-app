import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { KEY_VERSION, RETENTION_DAYS, archiveKey, buildSnapshot, eraseLiveData, open, seal } from "@/lib/account-archive";

export const maxDuration = 30;

// POST /api/account/delete  { confirm: "DELETE" }
// Archives the caller's data (encrypted), erases the live copies, flags the
// account as deleted and signs them out. Reversible for RETENTION_DAYS.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (body?.confirm !== "DELETE") return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 });

  const key = archiveKey();
  if (!key) {
    // Never keep an unencrypted copy: refuse until the key is set up.
    return NextResponse.json({ error: "Account deletion isn't set up on the server yet." }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role, account_deleted_at").eq("id", user.id).single();
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (profile.account_deleted_at) return NextResponse.json({ ok: true });
  if (profile.role === "admin") {
    return NextResponse.json({ error: "Admins can't delete their account here. Ask another admin to change your role first." }, { status: 403 });
  }

  try {
    const snapshot = await buildSnapshot(admin, user.id);
    const json = JSON.stringify(snapshot);
    const sealed = seal(json, key);
    // Prove the archive can be read back before anything is erased.
    if (open(sealed, key) !== json) throw new Error("archive check failed");

    const now = new Date();
    const purgeAfter = new Date(now.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const { error: archiveError } = await admin.from("account_archives").upsert(
      { user_id: user.id, ...sealed, key_version: KEY_VERSION, deleted_at: now.toISOString(), purge_after: purgeAfter.toISOString() },
      { onConflict: "user_id" }
    );
    if (archiveError) throw new Error(`archive: ${archiveError.message}`);

    await eraseLiveData(admin, user.id);
    await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...(user.app_metadata ?? {}), account_deleted: true } });
  } catch {
    return NextResponse.json({ error: "Couldn't delete your account. Nothing was lost. Please try again." }, { status: 500 });
  }

  await supabase.auth.signOut({ scope: "global" });
  return NextResponse.json({ ok: true, retentionDays: RETENTION_DAYS });
}
