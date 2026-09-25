"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, ShieldCheck, PenLine, Clock, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Shell } from "@/components/ui/Shell";
import { COLORS, DAILY_LIMIT_MS, fmtClock } from "@/lib/constants";
import type { Profile } from "@/lib/database.types";

interface ProfileClientProps {
  profile: Profile;
  usageMs: number;
  pendingCount: number;
}

export function ProfileClient({ profile, usageMs, pendingCount }: ProfileClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [resetting, setResetting] = useState(false);
  const [localUsageMs, setLocalUsageMs] = useState(usageMs);

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
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(201,162,39,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: COLORS.brass,
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
          </div>
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
