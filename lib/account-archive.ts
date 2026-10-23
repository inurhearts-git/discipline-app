// Account deletion with a restore window.
//
// delete  -> snapshot the person's data, encrypt it (AES-256-GCM), store it in
//            account_archives, erase the live rows, flag the account.
// restore -> decrypt the snapshot and put everything back.
// fresh   -> throw the archive away and reset the profile to blank.
// purge   -> after the window: erase the archive and the sign-in record.
//
// Nothing here runs in the browser. It needs ACCOUNT_ARCHIVE_KEY: 32 random
// bytes, base64-encoded. Without it, deleting is refused rather than storing
// anything unencrypted.

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const RETENTION_DAYS = 30;
export const KEY_VERSION = 1;

export function archiveKey(): Buffer | null {
  const raw = process.env.ACCOUNT_ARCHIVE_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  return key.length === 32 ? key : null;
}

export interface Sealed {
  ciphertext: string;
  iv: string;
  tag: string;
}

export function seal(plain: string, key: Buffer): Sealed {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { ciphertext: enc.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}

// Throws if the key is wrong or the data was altered.
export function open(sealed: Sealed, key: Buffer): string {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(sealed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(sealed.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

type Row = Record<string, unknown>;

export interface Snapshot {
  v: 1;
  profile: Row;
  interactions: Row[];
  usage: Row[];
  reflections: Row[];
  journal: Row[];
}

// The profile columns that are personal and get scrubbed, then restored.
const PROFILE_FIELDS = ["display_name", "bio", "birthdate", "avatar_color", "interests", "onboarded", "role", "terms_accepted_at", "terms_version"] as const;

// Reads every row (PostgREST returns at most 1000 at a time).
async function fetchAll(admin: SupabaseClient, table: string, column: string, userId: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select("*").eq(column, userId).range(from, from + 999);
    if (error) throw new Error(`read ${table}: ${error.message}`);
    out.push(...((data ?? []) as Row[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function buildSnapshot(admin: SupabaseClient, userId: string): Promise<Snapshot> {
  const { data: profile, error } = await admin.from("profiles").select(PROFILE_FIELDS.join(", ")).eq("id", userId).single();
  if (error || !profile) throw new Error("profile not found");
  return {
    v: 1,
    profile: profile as unknown as Row,
    interactions: await fetchAll(admin, "user_content_interactions", "user_id", userId),
    usage: await fetchAll(admin, "usage_sessions", "user_id", userId),
    reflections: await fetchAll(admin, "reflections", "user_id", userId),
    journal: await fetchAll(admin, "journal_entries", "user_id", userId),
  };
}

// Erases the live copies and scrubs the profile, then raises the flag.
export async function eraseLiveData(admin: SupabaseClient, userId: string): Promise<void> {
  for (const [table, column] of [
    ["user_content_interactions", "user_id"],
    ["usage_sessions", "user_id"],
    ["reflections", "user_id"],
    ["journal_entries", "user_id"],
  ] as const) {
    const { error } = await admin.from(table).delete().eq(column, userId);
    if (error) throw new Error(`erase ${table}: ${error.message}`);
  }
  // Notices, notice settings and push devices are not archived: they go now
  // (migrations 0017 and 0018; before they are run the tables don't exist).
  for (const table of ["notifications", "notification_settings", "push_subscriptions"]) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);
    if (error && error.code !== "42P01" && error.code !== "PGRST205") throw new Error(`erase ${table}: ${error.message}`);
  }
  // Their error reports stay (they help fix content) but lose the link to them.
  await admin.from("content_reports").update({ reporter_id: null }).eq("reporter_id", userId);

  const { error } = await admin
    .from("profiles")
    .update({
      display_name: "Deleted user",
      bio: null,
      birthdate: null,
      avatar_color: null,
      interests: [],
      onboarded: false,
      role: "viewer",
      terms_accepted_at: null,
      terms_version: null,
      account_deleted_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw new Error(`scrub profile: ${error.message}`);
}

// Puts a snapshot back. Rows that no longer fit (for example a quote that has
// since been removed) are skipped one by one rather than failing the restore.
async function putBack(admin: SupabaseClient, table: string, rows: Row[], onConflict: string): Promise<void> {
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await admin.from(table).upsert(chunk, { onConflict });
    if (!error) continue;
    for (const row of chunk) await admin.from(table).upsert(row, { onConflict });
  }
}

export async function restoreSnapshot(admin: SupabaseClient, userId: string, snap: Snapshot): Promise<void> {
  const { error } = await admin
    .from("profiles")
    .update({ ...snap.profile, account_deleted_at: null })
    .eq("id", userId);
  if (error) throw new Error(`restore profile: ${error.message}`);
  await putBack(admin, "journal_entries", snap.journal, "id");
  await putBack(admin, "reflections", snap.reflections, "id");
  await putBack(admin, "user_content_interactions", snap.interactions, "user_id,content_id");
  await putBack(admin, "usage_sessions", snap.usage, "user_id,date");
}

// After the window: remove the archive and the sign-in record for good. Quotes
// or clips the person submitted stay in the app, handed to an admin account,
// because content_items needs a submitter. Every step checks for errors, so a
// failure stops before the sign-in record is deleted and says why.
export class PurgeError extends Error {}

export async function purgeAccount(admin: SupabaseClient, userId: string): Promise<void> {
  const { data: admins, error: adminError } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .is("account_deleted_at", null)
    .neq("id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (adminError) throw new PurgeError(`couldn't look up admins: ${adminError.message}`);
  const heir = admins?.[0]?.id as string | undefined;
  if (!heir) throw new PurgeError("no other admin to take over their submissions");

  for (const [table, column] of [
    ["content_items", "submitted_by"],
    ["content_items", "reviewed_by"],
    ["content_meanings", "approved_by"],
  ] as const) {
    const { error } = await admin.from(table).update({ [column]: heir }).eq(column, userId);
    // content_meanings may not exist before migration 0009.
    if (error && !(table === "content_meanings" && (error.code === "42P01" || error.code === "PGRST205"))) throw new PurgeError(`hand over ${table}.${column}: ${error.message}`);
  }
  // Deleting the sign-in record also erases the archive (on delete cascade,
  // migration 0012). Doing it first means a failure never leaves a flagged
  // account with no archive to restore from.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new PurgeError(`delete sign-in record: ${error.message}`);
  const { error: archiveError } = await admin.from("account_archives").delete().eq("user_id", userId);
  if (archiveError) throw new PurgeError(`erase archive: ${archiveError.message}`);
}
