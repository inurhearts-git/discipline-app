"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { COLORS, alpha } from "@/lib/constants";
import { NOTICE_SETTINGS, type NoticeSettingId, type NoticeSettings } from "@/lib/notifications";

// Profile > Notifications: one switch per kind of notice. Saved at once.
// `settings` is null before migration 0017 is run.
export function NoticeSettingsCard({ settings: initial, role }: { settings: NoticeSettings | null; role: string }) {
  const [settings, setSettings] = useState(initial);
  const [saving, setSaving] = useState<NoticeSettingId | null>(null);
  const [error, setError] = useState("");
  const shown = NOTICE_SETTINGS.filter((s) => s.id !== "submissions" || role !== "viewer");

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
        Shown under the bell, inside the app only. Never more than a few a day.
      </p>
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
