// Push notifications (phone or browser lock-screen alerts). Server-only.
//
// A person turns them on from Profile > Notifications: the browser asks for
// permission and gives us an address at its push service (Google, Apple or
// Mozilla), which we store in push_subscriptions (migration 0018). To send,
// we post an encrypted message to that address, signed with our VAPID key.
//
// Env (Vercel, Production and Preview):
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY   public key (also used by the browser)
//   VAPID_PRIVATE_KEY              private key, never shown to anyone
//   VAPID_SUBJECT                  optional, "mailto:you@example.com"
// Without them, push is simply off and the app works as before.

import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

export function pushConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let ready = false;
function setup(): boolean {
  if (ready) return true;
  if (!pushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:alerts@discipline.invalid",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string
  );
  ready = true;
  return true;
}

export interface PushMessage {
  title: string;
  body?: string | null;
  url?: string | null; // a path inside the app
  tag?: string; // a newer message with the same tag replaces the older one
}

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushResult {
  sent: number;
  removed: number; // addresses the push service said are gone
  failed: number;
}

// Sends to every device each person turned push on for. Never throws.
export async function sendPush(admin: SupabaseClient, userIds: string[], msg: PushMessage): Promise<PushResult> {
  const result: PushResult = { sent: 0, removed: 0, failed: 0 };
  const users = Array.from(new Set(userIds.filter(Boolean)));
  if (!users.length || !setup()) return result;

  const { data, error } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", users);
  if (error) {
    if (error.code !== "42P01" && error.code !== "PGRST205") console.error(`[push] read subscriptions: ${error.message}`);
    return result;
  }
  const payload = JSON.stringify({ title: msg.title, body: msg.body ?? "", url: msg.url ?? "/feed", tag: msg.tag ?? "discipline" });
  const gone: string[] = [];
  const sentIds: string[] = [];
  await Promise.all(
    ((data ?? []) as SubRow[]).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 6 * 3600, urgency: "normal" });
        result.sent++;
        sentIds.push(s.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          gone.push(s.id); // unsubscribed or expired
        } else {
          result.failed++;
          console.error(`[push] send failed (${status ?? "network"}): ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    })
  );
  if (gone.length) {
    await admin.from("push_subscriptions").delete().in("id", gone);
    result.removed = gone.length;
  }
  if (sentIds.length) await admin.from("push_subscriptions").update({ last_sent_at: new Date().toISOString() }).in("id", sentIds);
  return result;
}
