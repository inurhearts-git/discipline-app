// Deleted-account gate for API routes (backlog item 3b).
//
// The middleware sends a deleted account (waiting out its restore window) to
// /welcome-back for every page, but it skips /api. An old session could still
// call API routes directly, so every authenticated route also calls this right
// after its sign-in check. The welcome-back routes (account/restore,
// account/fresh) and account/delete deliberately don't.

import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

export const ACCOUNT_DELETED_CODE = "account_deleted";

export function isDeletedAccount(user: Pick<User, "app_metadata"> | null | undefined): boolean {
  return user?.app_metadata?.account_deleted === true;
}

// 403 with a stable code the browser can recognise.
export function deletedAccountResponse(): NextResponse {
  return NextResponse.json(
    { error: "This account was deleted. Sign in again to restore it or start fresh.", code: ACCOUNT_DELETED_CODE },
    { status: 403, headers: { "Cache-Control": "no-store" } }
  );
}
