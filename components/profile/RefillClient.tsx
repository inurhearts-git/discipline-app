"use client";

import { useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/ui/Shell";
import { COLORS, alpha } from "@/lib/constants";

export interface RefillPerson {
  id: string;
  name: string;
  hasChannel: boolean;
  enabled: boolean;
  lastRunAt: string | null;
  lastAdded: number | null;
}

interface RunResult {
  channels: number;
  checked: number;
  added: number;
  skipped: { duplicate: number; length: number; notEmbeddable: number; live: number; blocked: number };
  errors: number;
  stopped: string | null;
  unitsUsed: number;
}

const ago = (iso: string | null) => {
  if (!iso) return "never";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 60 / 24)} d ago`;
};

export function RefillClient({ people, pending, pendingCap, unitsLeft }: { people: RefillPerson[]; pending: number; pendingCap: number; unitsLeft: number | null }) {
  const [rows, setRows] = useState(people);
  const [busy, setBusy] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);

  const withChannel = rows.filter((r) => r.hasChannel);
  const without = rows.filter((r) => !r.hasChannel);
  const onCount = rows.filter((r) => r.enabled).length;

  const toggle = async (p: RefillPerson) => {
    setBusy(p.id);
    setError("");
    try {
      const res = await fetch("/api/admin/refill/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ person_id: p.id, enabled: !p.enabled }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "That didn't work. Try again.");
        return;
      }
      setRows((prev) => prev.map((r) => (r.id === p.id ? { ...r, enabled: !r.enabled } : r)));
    } catch {
      setError("That didn't work. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const run = async () => {
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/admin/refill/run", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d.error || "The run failed. Try again.");
        return;
      }
      setResult(d as RunResult);
    } catch {
      setError("The run failed. Check your connection and try again.");
    } finally {
      setRunning(false);
    }
  };

  const small = { fontSize: 12, color: COLORS.slate, margin: 0 } as const;

  return (
    <Shell>
      <div style={{ padding: "24px 22px 32px" }}>
        <Link href="/profile" style={{ color: COLORS.slate, fontSize: 13, textDecoration: "none" }}>
          ← Profile
        </Link>
        <h1 style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontWeight: 400, fontSize: 28, color: COLORS.parchment, margin: "16px 0 6px" }}>Auto refill</h1>
        <p style={{ ...small, lineHeight: 1.6, margin: "0 0 16px" }}>
          Every day, new videos from the channels you switch on are checked and added to <Link href="/moderate" style={{ color: COLORS.brass }}>Review submissions</Link>. Nothing goes live until you approve it.
          Only embeddable videos under 4 minutes are added, at most 5 per channel a day.
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <span style={{ ...small, padding: "5px 10px", border: `1px solid ${COLORS.line}`, borderRadius: 999 }}>{onCount} channel{onCount === 1 ? "" : "s"} on</span>
          <span style={{ ...small, padding: "5px 10px", border: `1px solid ${COLORS.line}`, borderRadius: 999 }}>{pending}/{pendingCap} waiting</span>
          {unitsLeft !== null && <span style={{ ...small, padding: "5px 10px", border: `1px solid ${COLORS.line}`, borderRadius: 999 }}>{unitsLeft.toLocaleString()} YouTube units left today</span>}
        </div>

        <button
          onClick={run}
          disabled={running || onCount === 0}
          style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: "none", background: COLORS.brass, color: COLORS.onBrass, fontSize: 13, fontWeight: 500, cursor: running || onCount === 0 ? "default" : "pointer", opacity: running || onCount === 0 ? 0.45 : 1, marginBottom: 6 }}
        >
          {running ? "Checking channels…" : "Run now"}
        </button>
        <p style={{ ...small, marginBottom: 14 }}>It also runs by itself every day. Running now uses a few YouTube units, not a full search.</p>

        {error && <p role="alert" style={{ color: COLORS.danger, fontSize: 12, margin: "0 0 12px" }}>{error}</p>}

        {result && (
          <div style={{ border: `1px solid ${alpha(COLORS.brass, 45)}`, background: alpha(COLORS.brass, 8), borderRadius: 10, padding: 12, marginBottom: 16 }}>
            <p style={{ margin: "0 0 6px", fontSize: 14, color: COLORS.parchment, fontWeight: 500 }}>
              {result.added} new clip{result.added === 1 ? "" : "s"} added for review
            </p>
            <p style={{ ...small, lineHeight: 1.6 }}>
              Checked {result.checked} new upload{result.checked === 1 ? "" : "s"} across {result.channels} channel{result.channels === 1 ? "" : "s"}. Skipped: {result.skipped.duplicate} already in the app, {result.skipped.length} wrong
              length, {result.skipped.notEmbeddable} not embeddable, {result.skipped.live} live, {result.skipped.blocked} blocked topics. Used {result.unitsUsed} YouTube units.
              {result.errors > 0 ? ` ${result.errors} request${result.errors === 1 ? "" : "s"} failed.` : ""}
            </p>
            {result.stopped && <p style={{ margin: "6px 0 0", fontSize: 12, color: COLORS.danger }}>{result.stopped}</p>}
          </div>
        )}

        <h2 style={{ fontSize: 13, fontWeight: 600, color: COLORS.parchment, margin: "6px 0 8px" }}>Channels</h2>
        {withChannel.length === 0 && <p style={small}>No speakers with a YouTube channel yet. Add clips through Add speech clips in bulk and they will appear here.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {withChannel.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${p.enabled ? COLORS.brass : COLORS.line}`, borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: COLORS.parchment, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                <div style={small}>
                  {p.enabled ? `Last checked ${ago(p.lastRunAt)}${p.lastAdded !== null ? `, ${p.lastAdded} added` : ""}` : "Off"}
                </div>
              </div>
              <button
                role="switch"
                aria-checked={p.enabled}
                aria-label={`Auto refill for ${p.name}`}
                disabled={busy === p.id}
                onClick={() => toggle(p)}
                style={{ width: 44, height: 26, borderRadius: 13, border: "none", cursor: "pointer", position: "relative", background: p.enabled ? COLORS.brass : alpha(COLORS.parchment, 18), flexShrink: 0 }}
              >
                <span style={{ position: "absolute", top: 3, left: p.enabled ? 21 : 3, width: 20, height: 20, borderRadius: "50%", background: p.enabled ? COLORS.onBrass : COLORS.parchment, transition: "left 150ms" }} />
              </button>
            </div>
          ))}
        </div>

        {without.length > 0 && (
          <>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: COLORS.parchment, margin: "20px 0 6px" }}>No channel saved</h2>
            <p style={{ ...small, lineHeight: 1.6 }}>{without.map((p) => p.name).join(", ")}. Add a clip from their channel through the bulk page to save it.</p>
          </>
        )}
      </div>
    </Shell>
  );
}
