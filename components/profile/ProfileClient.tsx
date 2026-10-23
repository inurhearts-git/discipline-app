"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, ShieldCheck, PenLine, Clock, Settings2, Pencil, Check, X, Palette, Flame, Bookmark, BookOpen, NotebookPen, Plus, Flag, RefreshCw, Layers, Users, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Shell } from "@/components/ui/Shell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { COLORS, DAILY_LIMIT_MS, alpha, fmtClock, isAdult } from "@/lib/constants";
import { STREAK_MILESTONES, STREAK_MIN_MS, nextMilestone } from "@/lib/streak";
import type { Profile } from "@/lib/database.types";
import { Stamp } from "@/components/journal/Stamp";
import { LegalLinks } from "@/components/legal/LegalLinks";
import { DeleteAccount } from "@/components/profile/DeleteAccount";
import { NoticeSettingsCard } from "@/components/profile/NoticeSettings";
import type { NoticeSettings } from "@/lib/notifications";

interface UsageDay {
  date: string;
  msSpent: number;
}

interface ProfileClientProps {
  profile: Profile;
  usageMs: number;
  usageHistory: UsageDay[];
  streakBase: number; // consecutive qualifying days ending yesterday
  bestPast: number; // longest run before today
  pendingCount: number;
  adminAlert?: { lone: boolean; overdue: number; jobProblems: string[] } | null;
  savedCount: number;
  reflectionCount: number;
  journalCount: number;
  lastJournalAt: string | null;
  noticeSettings: NoticeSettings | null;
}

// Literal hex on purpose: these values are saved to profiles.avatar_color,
// so they must never be CSS-variable strings.
const DEFAULT_AVATAR = "#C9A227";
const AVATAR_COLORS = [DEFAULT_AVATAR, "#C2542E", "#8CA07A", "#9C968A", "#7A8FA6", "#A66B8F"];

const dayLabel = (dateStr: string) => {
  const d = new Date(`${dateStr}T00:00:00`);
  return ["S", "M", "T", "W", "T", "F", "S"][d.getDay()];
};

export function ProfileClient({ profile: initialProfile, usageMs, usageHistory, streakBase, bestPast, pendingCount, adminAlert, savedCount, reflectionCount, journalCount, lastJournalAt, noticeSettings }: ProfileClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState(initialProfile);
  const [resetting, setResetting] = useState(false);
  const [localUsageMs, setLocalUsageMs] = useState(usageMs);

  const [editing, setEditing] = useState(false);
  const [formName, setFormName] = useState(profile.display_name);
  const [formBio, setFormBio] = useState(profile.bio ?? "");
  const [formColor, setFormColor] = useState(profile.avatar_color ?? DEFAULT_AVATAR);
  const [formBirthdate, setFormBirthdate] = useState(profile.birthdate ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const avatarFg = profile.avatar_color ?? DEFAULT_AVATAR;
  const avatarBg = alpha(avatarFg, 15);

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
    setFormColor(profile.avatar_color ?? DEFAULT_AVATAR);
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

  // Streak: today joins the run once it passes the 2-minute mark.
  const todayCounted = localUsageMs >= STREAK_MIN_MS;
  const currentStreak = streakBase + (todayCounted ? 1 : 0);
  const bestStreakDays = Math.max(bestPast, currentStreak);
  const upcoming = nextMilestone(currentStreak);
  const prevMilestone = [...STREAK_MILESTONES].reverse().find((m) => m <= currentStreak) ?? 0;
  const toNext = upcoming === null ? 1 : Math.min(1, (currentStreak - prevMilestone) / (upcoming - prevMilestone));
  const dayWord = (n: number) => (n === 1 ? "day" : "days");

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
                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "9px", borderRadius: 8, border: `1px solid ${COLORS.brass}`, background: COLORS.brass, color: COLORS.onBrass, fontSize: 13, cursor: "pointer" }}
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Flame size={14} color={COLORS.ember} fill={todayCounted ? COLORS.ember : "none"} />
            <span style={{ fontSize: 12, color: COLORS.parchment }}>Streak</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div style={{ fontSize: 28, color: COLORS.parchment, fontFamily: "'Newsreader', serif", lineHeight: 1.1 }}>
              {currentStreak} <span style={{ fontSize: 13, color: COLORS.slate, fontFamily: "inherit" }}>{dayWord(currentStreak)}</span>
            </div>
            <div style={{ fontSize: 12, color: COLORS.slate }}>
              Best {bestStreakDays} {dayWord(bestStreakDays)}
            </div>
          </div>

          <div
            role="progressbar"
            aria-label="Progress to the next streak milestone"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(toNext * 100)}
            style={{ height: 4, background: COLORS.line, borderRadius: 2, marginTop: 12, overflow: "hidden" }}
          >
            <div style={{ height: "100%", width: `${toNext * 100}%`, background: COLORS.ember }} />
          </div>
          <p style={{ fontSize: 11, color: COLORS.slate, margin: "8px 0 0" }}>
            {currentStreak === 0
              ? bestStreakDays > 0
                ? "Your last streak ended. Spend a few minutes on the app to restart your streak."
                : "Spend a few minutes on the app to start a streak."
              : `${upcoming === null ? "You've passed every milestone." : `${upcoming - currentStreak} more ${dayWord(upcoming - currentStreak)} to reach ${upcoming}.`} ${
                  todayCounted ? "Today counts." : "Spend a few minutes on the app today to keep it going."
                }`}
          </p>

          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            {STREAK_MILESTONES.map((m) => {
              // Filled: reached in the current streak. Dashed: reached in an
              // earlier streak (your best), not in this one.
              const reached = currentStreak >= m;
              const before = !reached && bestStreakDays >= m;
              return (
                <div
                  key={m}
                  aria-label={`${m}-day streak, ${reached ? "reached" : before ? "reached in an earlier streak" : "not reached yet"}`}
                  title={reached ? `Reached ${m} days` : before ? `Reached ${m} days in an earlier streak` : `Reach a ${m}-day streak`}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    padding: "5px 0",
                    borderRadius: 8,
                    fontSize: 11,
                    border: `1px ${before ? "dashed" : "solid"} ${reached ? COLORS.ember : before ? alpha(COLORS.ember, 60) : COLORS.line}`,
                    background: reached ? alpha(COLORS.ember, 10) : "transparent",
                    color: reached || before ? COLORS.ember : COLORS.slate,
                  }}
                >
                  {(reached || before) && <Flame size={9} fill={reached ? COLORS.ember : "none"} />} {m}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <Link href="/journal" style={{ flex: 1, minWidth: 0, textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <NotebookPen size={14} color={COLORS.brass} />
                <span style={{ fontSize: 11, letterSpacing: 1.2, color: COLORS.parchment, fontWeight: 600 }}>JOURNAL</span>
              </div>
              <div style={{ fontSize: 22, color: COLORS.parchment, fontFamily: "'Newsreader', serif", lineHeight: 1.1 }}>
                {journalCount} <span style={{ fontSize: 12, color: COLORS.slate, fontFamily: "inherit" }}>{journalCount === 1 ? "entry" : "entries"}</span>
              </div>
              <div style={{ fontSize: 11, color: COLORS.slate, marginTop: 4 }}>
                {lastJournalAt ? <Stamp iso={lastJournalAt} prefix="Last: " /> : "Private, up to 1,000 words an entry"}
              </div>
            </Link>
            <Link
              href="/journal/new"
              style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "9px 12px", borderRadius: 10, background: COLORS.brass, color: COLORS.onBrass, fontSize: 12, fontWeight: 600, textDecoration: "none", flexShrink: 0 }}
            >
              <Plus size={14} /> Write
            </Link>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          {[
            { href: "/saved", Icon: Bookmark, label: "Saved", count: savedCount, hint: savedCount === 1 ? "item" : "items" },
            { href: "/reflections", Icon: BookOpen, label: "Reflections", count: reflectionCount, hint: reflectionCount === 1 ? "day" : "days" },
          ].map(({ href, Icon, label, count, hint }) => (
            <Link key={href} href={href} style={{ flex: 1, border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 14, textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <Icon size={14} color={COLORS.brass} />
                <span style={{ fontSize: 12, color: COLORS.parchment }}>{label}</span>
              </div>
              <div style={{ fontSize: 22, color: COLORS.parchment, fontFamily: "'Newsreader', serif", lineHeight: 1.1 }}>
                {count} <span style={{ fontSize: 12, color: COLORS.slate, fontFamily: "inherit" }}>{hint}</span>
              </div>
            </Link>
          ))}
        </div>

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
                const isToday = day.date === usageHistory[usageHistory.length - 1]?.date;
                const barPx = Math.max(3, Math.round(Math.min(1, day.msSpent / maxDayMs) * 38));
                return (
                  <div key={day.date} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 6 }}>
                    <div
                      title={fmtClock(day.msSpent)}
                      style={{
                        width: "100%",
                        height: barPx,
                        borderRadius: 2,
                        background: isToday ? COLORS.brass : alpha(COLORS.brass, 35),
                      }}
                    />
                    <span style={{ fontSize: 9, color: isToday ? COLORS.brass : COLORS.slate }}>{dayLabel(day.date)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Palette size={14} color={COLORS.brass} />
            <span style={{ fontSize: 12, color: COLORS.parchment }}>Appearance</span>
          </div>
          <ThemeToggle />
        </div>

        <NoticeSettingsCard settings={noticeSettings} role={profile.role} />

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

        {profile.role === "admin" && adminAlert && (
          <Link
            href="/moderate/admins"
            role="alert"
            style={{ display: "flex", gap: 10, alignItems: "flex-start", border: `1px solid ${alpha(COLORS.ember, 55)}`, background: alpha(COLORS.ember, 10), borderRadius: 10, padding: 12, marginBottom: 12, textDecoration: "none" }}
          >
            <AlertTriangle size={16} color={COLORS.ember} style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 12, lineHeight: 1.55, color: COLORS.parchment }}>
              {adminAlert.lone && <div>You are the only admin. Add a second admin so reviews don&apos;t depend on one person.</div>}
              {adminAlert.overdue > 0 && (
                <div style={{ marginTop: adminAlert.lone ? 4 : 0 }}>
                  {adminAlert.overdue} deleted account{adminAlert.overdue === 1 ? " is" : "s are"} overdue for erasure.
                </div>
              )}
              {adminAlert.jobProblems.map((p) => (
                <div key={p} style={{ marginTop: 4 }}>
                  {p}
                </div>
              ))}
              <div style={{ color: COLORS.brass, marginTop: 4 }}>Open Admins →</div>
            </div>
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
              <span style={{ background: COLORS.ember, color: COLORS.onEmber, fontSize: 11, borderRadius: 10, padding: "2px 7px" }}>{pendingCount}</span>
            )}
          </Link>
        )}

        {profile.role === "admin" && (
          <Link
            href="/moderate/reports"
            style={{ textAlign: "left", border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 14, marginTop: 12, background: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
          >
            <Flag size={16} color={COLORS.parchment} />
            <div style={{ color: COLORS.parchment, fontSize: 13, fontWeight: 500 }}>Reported errors</div>
          </Link>
        )}

        {profile.role === "admin" && (
          <Link
            href="/moderate/refill"
            style={{ textAlign: "left", border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 14, marginTop: 12, background: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
          >
            <RefreshCw size={16} color={COLORS.parchment} />
            <div style={{ color: COLORS.parchment, fontSize: 13, fontWeight: 500 }}>Auto refill</div>
          </Link>
        )}

        {profile.role === "admin" && (
          <Link
            href="/moderate/collections"
            style={{ textAlign: "left", border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 14, marginTop: 12, background: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
          >
            <Layers size={16} color={COLORS.parchment} />
            <div style={{ color: COLORS.parchment, fontSize: 13, fontWeight: 500 }}>Collections</div>
          </Link>
        )}

        {profile.role === "admin" && (
          <Link
            href="/moderate/admins"
            style={{ textAlign: "left", border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 14, marginTop: 12, background: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}
          >
            <Users size={16} color={COLORS.parchment} />
            <div style={{ flex: 1, color: COLORS.parchment, fontSize: 13, fontWeight: 500 }}>Admins</div>
            {adminAlert && <AlertTriangle size={14} color={COLORS.ember} aria-label="Needs attention" />}
          </Link>
        )}

        <p style={{ margin: "22px 0 0", fontSize: 11, lineHeight: 1.55, color: COLORS.slate, textAlign: "center" }}>
          Quotes and sources come from public places and may be wrong. Check the source before changing anything in your life.
        </p>
        <LegalLinks />
        <DeleteAccount isAdmin={profile.role === "admin"} retentionDays={30} />
      </div>
    </Shell>
  );
}
