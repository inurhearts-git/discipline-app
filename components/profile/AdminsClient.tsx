"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Shell } from "@/components/ui/Shell";
import { COLORS, alpha } from "@/lib/constants";
import type { AdminPerson, ErasureStatus } from "@/lib/admins";

interface Found {
  id: string;
  display_name: string;
  email: string;
  role: "viewer" | "creator" | "admin";
  onboarded: boolean;
  isYou: boolean;
}

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export function AdminsClient({ admins, meId, erasure }: { admins: AdminPerson[]; meId: string; erasure: ErasureStatus | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<Found | null>(null);
  const [looking, setLooking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [purging, setPurging] = useState(false);
  const [purgeMsg, setPurgeMsg] = useState<{ text: string; bad: boolean } | null>(null);

  const lone = admins.length <= 1;
  const small: CSSProperties = { fontSize: 12, color: COLORS.slate, margin: 0, lineHeight: 1.6 };
  const card: CSSProperties = { border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 14, marginBottom: 14 };
  const h2: CSSProperties = { fontSize: 14, fontWeight: 500, color: COLORS.parchment, margin: "0 0 8px" };

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setLooking(true);
    setError("");
    setNotice("");
    setFound(null);
    try {
      const res = await fetch(`/api/admin/roles?email=${encodeURIComponent(email.trim())}`, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error || "Couldn't look that up.");
      else setFound(d.person);
    } catch {
      setError("Couldn't look that up. Check your connection.");
    } finally {
      setLooking(false);
    }
  }

  async function setRole(userId: string, name: string, role: Found["role"]) {
    const what = role === "admin" ? `Make ${name} an admin? They will be able to approve content, change roles and see reports.` : `Change ${name} to ${role}?`;
    if (!window.confirm(what)) return;
    setBusy(userId);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, role }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || "That didn't work. Try again.");
        return;
      }
      setNotice(`${name} is now ${role === "admin" ? "an admin" : `a ${role}`}.`);
      setFound((f) => (f && f.id === userId ? { ...f, role } : f));
      router.refresh();
    } catch {
      setError("That didn't work. Check your connection.");
    } finally {
      setBusy(null);
    }
  }

  async function runPurge() {
    setPurging(true);
    setPurgeMsg(null);
    try {
      const res = await fetch("/api/admin/purge", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setPurgeMsg({ text: d.error || "The run failed.", bad: true });
      else setPurgeMsg({ text: d.summary, bad: !!d.blocked || (d.failed?.length ?? 0) > 0 });
      router.refresh();
    } catch {
      setPurgeMsg({ text: "The run failed. Check your connection.", bad: true });
    } finally {
      setPurging(false);
    }
  }

  const btn = (primary: boolean, disabled: boolean): CSSProperties => ({
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.45 : 1,
    border: primary ? "none" : `1px solid ${COLORS.line}`,
    background: primary ? COLORS.brass : "transparent",
    color: primary ? COLORS.onBrass : COLORS.parchment,
  });

  return (
    <Shell>
      <div style={{ padding: "24px 22px 32px" }}>
        <Link href="/profile" style={{ color: COLORS.slate, fontSize: 13, textDecoration: "none" }}>
          ← Profile
        </Link>
        <h1 style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontWeight: 400, fontSize: 28, color: COLORS.parchment, margin: "16px 0 6px" }}>Admins</h1>
        <p style={{ ...small, margin: "0 0 16px" }}>Admins approve content, handle reports and change roles. Erasing deleted accounts also needs an admin to take over what those people submitted.</p>

        {lone && (
          <div role="alert" style={{ display: "flex", gap: 10, border: `1px solid ${alpha(COLORS.ember, 55)}`, background: alpha(COLORS.ember, 10), borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <AlertTriangle size={18} color={COLORS.ember} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ ...small, color: COLORS.parchment }}>
              You are the only admin. If you lose access, nobody can review submissions or change roles. Add a second admin you trust below.
            </p>
          </div>
        )}

        {error && <p role="alert" style={{ color: COLORS.danger, fontSize: 12, margin: "0 0 12px" }}>{error}</p>}
        {notice && <p style={{ color: COLORS.sage, fontSize: 12, margin: "0 0 12px" }}>{notice}</p>}

        <div style={card}>
          <p style={h2}>Current admins ({admins.length})</p>
          {admins.map((a) => (
            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderTop: `1px solid ${COLORS.line}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: COLORS.parchment }}>
                  {a.display_name}
                  {a.id === meId ? " (you)" : ""}
                </div>
                <div style={{ ...small, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.email}</div>
              </div>
              {a.id !== meId && (
                <button type="button" onClick={() => setRole(a.id, a.display_name, "creator")} disabled={busy === a.id || lone} style={btn(false, busy === a.id || lone)}>
                  Remove admin
                </button>
              )}
            </div>
          ))}
          <p style={{ ...small, marginTop: 8 }}>Removing an admin makes them a creator. You can&apos;t change your own role, and the last admin can&apos;t be removed.</p>
        </div>

        <div style={card}>
          <p style={h2}>Add an admin or creator</p>
          <form onSubmit={lookup} style={{ display: "flex", gap: 8 }}>
            <input
              type="email"
              required
              placeholder="Their sign-in email"
              aria-label="Their sign-in email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFound(null);
              }}
              style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "transparent", color: COLORS.parchment, fontSize: 13 }}
            />
            <button type="submit" disabled={looking || !email.trim()} style={btn(false, looking || !email.trim())}>
              {looking ? "Finding…" : "Find"}
            </button>
          </form>
          <p style={{ ...small, marginTop: 6 }}>They need an account already. Only an exact email match is shown.</p>

          {found && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.line}` }}>
              <div style={{ fontSize: 13, color: COLORS.parchment }}>{found.display_name}</div>
              <div style={small}>
                {found.email} · now {found.role}
                {found.onboarded ? "" : " · hasn't finished onboarding"}
              </div>
              {found.isYou ? (
                <p style={{ ...small, marginTop: 8 }}>That&apos;s you. Another admin has to change your role.</p>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {found.role !== "admin" && (
                    <button type="button" onClick={() => setRole(found.id, found.display_name, "admin")} disabled={busy === found.id} style={btn(true, busy === found.id)}>
                      Make admin
                    </button>
                  )}
                  {found.role !== "creator" && (
                    <button type="button" onClick={() => setRole(found.id, found.display_name, "creator")} disabled={busy === found.id} style={btn(false, busy === found.id)}>
                      Make creator
                    </button>
                  )}
                  {found.role !== "viewer" && (
                    <button type="button" onClick={() => setRole(found.id, found.display_name, "viewer")} disabled={busy === found.id} style={btn(false, busy === found.id)}>
                      Make viewer
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={card}>
          <p style={h2}>Erasing deleted accounts</p>
          {erasure === null ? (
            <p style={small}>Account deletion isn&apos;t set up yet (migration 0012).</p>
          ) : (
            <>
              <p style={small}>
                {erasure.waiting} deleted account{erasure.waiting === 1 ? "" : "s"} inside the 30-day restore window.{" "}
                {erasure.overdue === 0 ? "None overdue." : ""}
              </p>
              {erasure.overdue > 0 && (
                <p style={{ ...small, color: COLORS.danger, marginTop: 4 }}>
                  {erasure.overdue} account{erasure.overdue === 1 ? " is" : "s are"} past the window and not erased
                  {erasure.oldestOverdue ? ` (oldest due ${fmtDay(erasure.oldestOverdue)})` : ""}. Run it now to see why.
                </p>
              )}
            </>
          )}
          <button type="button" onClick={runPurge} disabled={purging || erasure === null} style={{ ...btn(erasure !== null && erasure.overdue > 0, purging || erasure === null), marginTop: 10 }}>
            {purging ? "Running…" : "Run erasure now"}
          </button>
          <p style={{ ...small, marginTop: 6 }}>It also runs by itself every day at 03:00 UTC. Only accounts past their window are erased.</p>
          {purgeMsg && <p style={{ fontSize: 12, margin: "8px 0 0", color: purgeMsg.bad ? COLORS.danger : COLORS.sage }}>{purgeMsg.text}</p>}
        </div>
      </div>
    </Shell>
  );
}
