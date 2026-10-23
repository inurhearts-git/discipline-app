"use client";

import { useEffect, useState } from "react";
import { Bell, Smartphone } from "lucide-react";
import { currentSubscription, disablePush, enablePush, pushSupport } from "@/lib/push-client";
import { COLORS, alpha } from "@/lib/constants";
import { NOTICE_SETTINGS, type NoticeSettingId, type NoticeSettings } from "@/lib/notice-settings";

// Profile > Notifications: one switch per kind of notice. Saved at once.
// `settings` is null before migration 0017 is run.
type PushState = "ready" | "no-keys" | "no-migration";

export function NoticeSettingsCard({ settings: initial, role, pushState = "no-migration" }: { settings: NoticeSettings | null; role: string; pushState?: PushState }) {
  const [settings, setSettings] = useState(initial);
  const [saving, setSaving] = useState<NoticeSettingId | null>(null);
  const [error, setError] = useState("");
  const shown = NOTICE_SETTINGS.filter((s) => (s.id !== "submissions" || role !== "viewer") && (!settings || s.id in settings));

  const toggle = async (id: NoticeSettingId) => {
    if (!settings) return;
    const next = !settings[id];
    setSettings({ ...settings, [id]: next });
    setSaving(id);
    setError("");
    try {
      const res = await fetch("/api/notifications/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [id]: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't save that. Try again.");
      setSettings(data.settings);
    } catch (e) {
      setSettings((s) => (s ? { ...s, [id]: !next } : s));
      setError(e instanceof Error ? e.message : "Couldn't save that. Try again.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div id="notices" style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 14, marginBottom: 12, scrollMarginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Bell size={14} color={COLORS.brass} />
        <span style={{ fontSize: 12, color: COLORS.parchment }}>Notifications</span>
      </div>
      <p style={{ fontSize: 11, color: COLORS.slate, margin: "0 0 10px", lineHeight: 1.5 }}>
        Shown under the bell, and on your phone if you turn that on. Never more than a few a day.
      </p>
      {settings !== null && pushState !== "no-migration" && <PushRow pushState={pushState} isAdmin={role === "admin"} />}
      {settings === null ? (
        <p style={{ fontSize: 12, color: COLORS.slate, margin: 0 }}>Not switched on yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {shown.map((s, i) => {
            const on = settings[s.id];
            return (
              <label
                key={s.id}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i ? `1px solid ${COLORS.line}` : "none", cursor: "pointer" }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13, color: COLORS.parchment }}>{s.label}</span>
                  <span style={{ display: "block", fontSize: 11, color: COLORS.slate, lineHeight: 1.45, marginTop: 2 }}>{s.hint}</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={s.label}
                  disabled={saving === s.id}
                  onClick={() => toggle(s.id)}
                  style={{
                    width: 40,
                    height: 24,
                    borderRadius: 12,
                    border: `1px solid ${on ? COLORS.brass : COLORS.line}`,
                    background: on ? COLORS.brass : alpha(COLORS.slate, 18),
                    position: "relative",
                    cursor: "pointer",
                    flexShrink: 0,
                    padding: 0,
                    transition: "background 0.15s",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: 2,
                      left: on ? 18 : 2,
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      background: on ? COLORS.onBrass : COLORS.parchment,
                      transition: "left 0.15s",
                    }}
                  />
                </button>
              </label>
            );
          })}
        </div>
      )}
      {role === "admin" && settings !== null && (
        <p style={{ fontSize: 11, color: COLORS.slate, margin: "8px 0 0", lineHeight: 1.5 }}>
          Admin notices (failed jobs, reported errors, submissions waiting, overdue erasures) are always on.
        </p>
      )}
      {error && (
        <p role="alert" style={{ color: COLORS.danger, fontSize: 12, margin: "8px 0 0" }}>
          {error}
        </p>
      )}
    </div>
  );
}

// "Phone notifications": turns push on or off for this device.
function PushRow({ pushState, isAdmin }: { pushState: PushState; isAdmin: boolean }) {
  const [status, setStatus] = useState<"loading" | "on" | "off" | "blocked" | "ios" | "unsupported">("loading");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    const support = pushSupport();
    if (support === "ios-needs-home-screen") return setStatus("ios");
    if (support === "unsupported") return setStatus("unsupported");
    if (Notification.permission === "denied") return setStatus("blocked");
    currentSubscription()
      .then((s) => setStatus(s && Notification.permission === "granted" ? "on" : "off"))
      .catch(() => setStatus("off"));
  }, []);

  if (pushState === "no-keys") {
    return isAdmin ? (
      <p style={{ fontSize: 11, color: COLORS.slate, margin: "0 0 10px", lineHeight: 1.5 }}>
        Phone notifications aren&apos;t set up yet: add the VAPID keys in Vercel (see the backlog).
      </p>
    ) : null;
  }

  const turnOn = async () => {
    setBusy(true);
    setNote("");
    try {
      const problem = await enablePush(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "");
      if (problem === "blocked") setStatus("blocked");
      else if (problem) setNote(problem);
      else setStatus("on");
    } catch {
      setNote("Couldn't turn notifications on. Try again.");
    } finally {
      setBusy(false);
    }
  };
  const turnOff = async () => {
    setBusy(true);
    setNote("");
    await disablePush().catch(() => undefined);
    setStatus("off");
    setBusy(false);
  };
  const test = async () => {
    setBusy(true);
    setNote("");
    const res = await fetch("/api/push/test", { method: "POST" }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setNote(res?.ok ? "Sent. It should appear in a few seconds." : data.error || "Couldn't send a test.");
    setBusy(false);
  };

  const btn = (primary: boolean) => ({
    padding: "7px 12px",
    borderRadius: 8,
    fontSize: 12,
    cursor: busy ? "default" : "pointer",
    opacity: busy ? 0.5 : 1,
    border: `1px solid ${primary ? COLORS.brass : COLORS.line}`,
    background: primary ? COLORS.brass : "transparent",
    color: primary ? COLORS.onBrass : COLORS.parchment,
    fontFamily: "inherit",
    flexShrink: 0,
  });

  const line =
    status === "on"
      ? "On for this device. Streak reminders, a nudge when you've been away, and news about your submissions reach you here."
      : status === "off"
        ? "Get streak reminders and a nudge when you've been away, even when the app is closed."
        : status === "blocked"
          ? "Blocked in your browser settings. Allow notifications for this site, then come back here."
          : status === "ios"
            ? "On iPhone: tap Share, then Add to Home Screen, and open Discipline from there to turn these on."
            : status === "unsupported"
              ? "This browser can't show notifications."
              : " ";

  return (
    <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: 10, marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <Smartphone size={15} color={COLORS.brass} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: COLORS.parchment }}>Phone notifications</div>
          <div style={{ fontSize: 11, color: COLORS.slate, lineHeight: 1.45, marginTop: 2 }}>{line}</div>
        </div>
        {status === "off" && (
          <button type="button" onClick={turnOn} disabled={busy} style={btn(true)}>
            Turn on
          </button>
        )}
      </div>
      {status === "on" && (
        <div style={{ display: "flex", gap: 8, marginTop: 10, paddingLeft: 25 }}>
          <button type="button" onClick={test} disabled={busy} style={btn(false)}>
            Send a test
          </button>
          <button type="button" onClick={turnOff} disabled={busy} style={btn(false)}>
            Turn off
          </button>
        </div>
      )}
      {note && (
        <p role="status" style={{ fontSize: 11, color: COLORS.slate, margin: "8px 0 0", paddingLeft: 25 }}>
          {note}
        </p>
      )}
    </div>
  );
}
