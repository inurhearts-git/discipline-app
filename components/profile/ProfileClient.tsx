"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, ShieldCheck, PenLine, Clock, Settings2, Pencil, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Shell } from "@/components/ui/Shell";
import { COLORS, DAILY_LIMIT_MS, fmtClock, isAdult } from "@/lib/constants";
import type { Profile } from "@/lib/database.types";

interface UsageDay {
  date: string;
  msSpent: number;
}

interface ProfileClientProps {
  profile: Profile;
  usageMs: number;
  usageHistory: UsageDay[];
  pendingCount: number;
}

const AVATAR_COLORS = [COLORS.brass, COLORS.ember, COLORS.sage, COLORS.slate, "#7A8FA6", "#A66B8F"];

const dayLabel = (dateStr: string) => {
  const d = new Date(`${dateStr}T00:00:00`);
  return ["S", "M", "T", "W", "T", "F", "S"][d.getDay()];
};

export function ProfileClient({ profile: initialProfile, usageMs, usageHistory, pendingCount }: ProfileClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState(initialProfile);
  const [resetting, setResetting] = useState(false);
  const [localUsageMs, setLocalUsageMs] = useState(usageMs);

  const [editing, setEditing] = useState(false);
  const [formName, setFormName] = useState(profile.display_name);
  const [formBio, setFormBio] = useState(profile.bio ?? "");
  const [formColor, setFormColor] = useState(profile.avatar_color ?? COLORS.brass);
  const [formBirthdate, setFormBirthdate] = useState(profile.birthdate ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const avatarBg = profile.avatar_color ? `${profile.avatar_color}26` : "rgba(201,162,39,0.15)";
  const avatarFg = profile.avatar_color ?? COLORS.brass;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };

  const handleResetUsage = async () => {
    setResetting(true);
    const res = await fetch("/api/usage/reset", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setLocalUsageMs(data.msSpentToday);
    }
    setResetting(false);
  };

  const startEditing = () => {
    setFormName(profile.display_name);
    setFormBio(profile.bio ?? "");
    setFormColor(profile.avatar_color ?? COLORS.brass);
    setFormBirthdate(profile.birthdate ?? "");
    setError("");
    setEditing(true);
  };

  const saveProfile = async () => {
    if (!formName.trim()) {
      setError("Name can't be empty.");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: formName.trim(),
        bio: formBio.trim() || null,
        avatar_color: formColor,
        birthdate: formBirthdate || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Couldn't save changes.");
      return;
    }
    const data = await res.json();
    setProfile(data.profile);
    setEditing(false);
  };

  const maxDayMs = Math.max(DAILY_LIMIT_MS, ...usageHistory.map((d) => d.msSpent));
  const adult = isAdult(profile.birthdate);

  return (
    <Shell>
      <div style={{ padding: "24px 22px 28px", minHeight: 720, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <Link href="/feed" style={{ background: "none", border: "none", color: COLORS.slate, cursor: "pointer", fontSize: 13, textDecoration: "none" }}>
            ← Feed
          </Link>
          <button onClick={handleLogout} aria-label="Log out" style={{ background: "none", border: "none", color: COLORS.slate, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <LogOut size={14} /> Log out
          </button>
        </div>

        {!editing ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: avatarBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: avatarFg,
                  fontFamily: "'Newsreader', serif",
                  fontStyle: "italic",
                  fontSize: 18,
                }}
              >
                {profile.display_name[0].toUpperCase()}
              </div>
              <div>
                <div style={{ color: COLORS.parchment, fontSize: 16, fontWeight: 500 }}>{profile.display_name}</div>
                <div style={{ color: COLORS.slate, fontSize: 12, textTransform: "capitalize" }}>{profile.role}</div>
                {profile.bio && <div style={{ color: COLORS.slate, fontSize: 12, marginTop: 4, maxWidth: 220 }}>{profile.bio}</div>}
              </div>
            </div>
            <button
              onClick={startEditing}
              aria-label="Edit profile"
              style={{ background: "none", border: `1px solid ${COLORS.line}`, borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
            >
              <Pencil size={13} color={COLORS.parchment} />
            </button>
          </div>
        ) : (
          <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 14, marginBottom: 24 }}>
            <label className="mf-label">Name</label>
            <input className="mf-input" value={formName} onChange={(e) => setFormName(e.target.value)} maxLength={40} />
            <label className="mf-label">Bio</label>
            <textarea
              className="mf-input"
              rows={2}
              placeholder="A line about you (optional)"
              value={formBio}
              onChange={(e) => setFormBio(e.target.value)}
              maxLength={140}
              style={{ resize: "vertical" }}
            />
            <label className="mf-label">Date of birth</label>
            <input
              className="mf-input"
              type="date"
              value={formBirthdate}
              onChange={(e) => setFormBirthdate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
            />
            <p style={{ color: COLORS.slate, fontSize: 11, margin: "-6px 0 12px" }}>
              Unlocks mature content when it confirms you&apos;re 18+. Never shown to anyone else.
            </p>
            <label className="mf-label">Avatar color</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setFormColor(c)}
                  aria-label={`Choose color ${c}`}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: c,
                    border: formColor === c ? `2px solid ${COLORS.parchment}` : "2px solid transparent",
                    cursor: "pointer",
                    padding: 0,
                  }}
                />
              ))}
            </div>
            {error && <p style={{ color: COLORS.danger, fontSize: 12, margin: "0 0 10px" }}>{error}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={saveProfile}
                disabled={saving}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 8, border: `1px solid ${COLORS.brass}`, background: COLORS.brass, color: COLORS.ink, fontSize: 13, cursor: "pointer" }}
              >
                <Check size={14} /> {saving ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "transparent", color: COLORS.parchment, fontSize: 13, cursor: "pointer" }}
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        )}

        {!editing && !adult && (
          <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 12, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: 12, color: COLORS.slate }}>
              {profile.birthdate ? "Mature content is hidden." : "Add your birthdate to unlock mature content."}
            </span>
            <button onClick={startEditing} style={{ background: "none", border: "none", color: COLORS.brass, fontSize: 12, cursor: "pointer", flexShrink: 0 }}>
              Edit
            </button>
          </div>
        )}

        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Clock size={14} color={COLORS.brass} />
            <span style={{ fontSize: 12, color: COLORS.parchment }}>Today&apos;s usage</span>
          </div>
          <div style={{ fontSize: 20, color: COLORS.parchment, fontFamily: "'Newsreader', serif" }}>
            {fmtClock(localUsageMs)} <span style={{ fontSize: 12, color: COLORS.slate }}>/ 60:00</span>
          </div>
          <div style={{ height: 4, background: COLORS.line, borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, (localUsageMs / DAILY_LIMIT_MS) * 100)}%`, background: COLORS.brass }} />
          </div>
          <button
            onClick={handleResetUsage}
            disabled={resetting}
            style={{ background: "none", border: "none", color: COLORS.slate, fontSize: 11, marginTop: 8, cursor: "pointer", textDecoration: "underline" }}
          >
            Reset usage (dev only)
          </button>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${COLORS.line}` }}>
            <span className="mf-label" style={{ marginBottom: 10 }}>
              Last 7 days
            </span>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 56 }}>
              {usageHistory.map((day) => {
                const isToday = day.date === new Date().toISOString().slice(0, 10);
                const heightPct = Math.max(3, Math.min(100, (day.msSpent / maxDayMs) * 100));
                return (
                  <div key={day.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div
                      title={fmtClock(day.msSpent)}
                      style={{
                        width: "100%",
                        height: `${heightPct}%`,
                        minHeight: 3,
                        borderRadius: 2,
                        background: isToday ? COLORS.brass : "rgba(201,162,39,0.35)",
                      }}
                    />
                    <span style={{ fontSize: 9, color: isToday ? COLORS.brass : COLORS.slate }}>{dayLabel(day.date)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <Link
          href="/onboarding"
          style={{ textAlign: "left", border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 14, marginBottom: 12, background: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
        >
          <Settings2 size={16} color={COLORS.parchment} />
          <div>
            <div style={{ color: COLORS.parchment, fontSize: 13, fontWeight: 500 }}>Edit feed preferences</div>
            <div style={{ color: COLORS.slate, fontSize: 11 }}>{profile.interests.length ? profile.interests.join(", ") : "Showing everything"}</div>
          </div>
        </Link>

        {profile.role !== "viewer" && (
          <Link
            href="/submit"
            style={{ textAlign: "left", border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 14, marginBottom: 12, background: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
          >
            <PenLine size={16} color={COLORS.parchment} />
            <div style={{ color: COLORS.parchment, fontSize: 13, fontWeight: 500 }}>Submit content</div>
          </Link>
        )}

        {profile.role === "admin" && (
          <Link
            href="/moderate"
            style={{ textAlign: "left", border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 14, background: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
          >
            <ShieldCheck size={16} color={COLORS.parchment} />
            <div style={{ flex: 1 }}>
              <div style={{ color: COLORS.parchment, fontSize: 13, fontWeight: 500 }}>Review submissions</div>
            </div>
            {pendingCount > 0 && (
              <span style={{ background: COLORS.ember, color: COLORS.parchment, fontSize: 11, borderRadius: 10, padding: "2px 7px" }}>{pendingCount}</span>
            )}
          </Link>
        )}
      </div>
    </Shell>
  );
}
