import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdult } from "@/lib/constants";
import { MIN_AGE, TERMS_VERSION } from "@/lib/legal";

// POST /api/account/fresh  { birthdate: "YYYY-MM-DD", accept: true }
// For a signed-in person whose account is flagged deleted: erase the old
// archive for good and begin again with the same email and password. Age and
// agreement are asked for again because a new journey starts from nothing.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const birthdate = typeof body?.birthdate === "string" ? body.birthdate : "";
  if (body?.accept !== true) return NextResponse.json({ error: "Please agree to the Terms and Privacy first." }, { status: 400 });
  if (!birthdate || !isAdult(birthdate)) {
    return NextResponse.json({ error: `Discipline is for people aged ${MIN_AGE} or over.` }, { status: 400 });
  }

  const admin = createAdminClient();
  // Gone for good: the encrypted copy of their old details.
  await admin.from("account_archives").delete().eq("user_id", user.id);

  const localPart = (user.email ?? "friend").split("@")[0];
  const { error } = await admin
    .from("profiles")
    .update({
      display_name: localPart,
      bio: null,
      birthdate,
      avatar_color: null,
      interests: [],
      onboarded: false,
      role: "viewer",
      terms_accepted_at: new Date().toISOString(),
      terms_version: TERMS_VERSION,
      account_deleted_at: null,
    })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: "Couldn't start fresh. Please try again." }, { status: 500 });

  await admin.auth.admin.updateUserById(user.id, { app_metadata: { account_deleted: null } });
  return NextResponse.json({ ok: true });
}
