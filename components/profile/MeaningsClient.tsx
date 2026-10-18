"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Check, RotateCcw, EyeOff } from "lucide-react";
import { Shell } from "@/components/ui/Shell";
import { COLORS, alpha, tagColor } from "@/lib/constants";
import type { ContentTag } from "@/lib/database.types";

export interface MeaningRow {
  id: string;
  text: string;
  attributed_to: string | null;
  source: string | null;
  tag: string;
  meaning: string;
  status: "missing" | "draft" | "approved";
}

type Filter = "draft" | "missing" | "approved";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "draft", label: "To review" },
  { key: "missing", label: "No meaning" },
  { key: "approved", label: "Live" },
];

const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);

export function MeaningsClient({ rows: initial, claudeReady, tableReady }: { rows: MeaningRow[]; claudeReady: boolean; tableReady: boolean }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [drafts, setDrafts] = useState<Record<string, string>>(() => Object.fromEntries(initial.map((r) => [r.id, r.meaning])));
  const [filter, setFilter] = useState<Filter>(initial.some((r) => r.status === "draft") ? "draft" : "missing");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [batch, setBatch] = useState<{ running: boolean; drafted: number; remaining: number | null }>({ running: false, drafted: 0, remaining: null });

  const counts = useMemo(() => {
    const c = { draft: 0, missing: 0, approved: 0 };
    rows.forEach((r) => (c[r.status] += 1));
    return c;
  }, [rows]);
  const shown = rows.filter((r) => r.status === filter);

  const apply = (id: string, m: { text: string; status: string } | null) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, meaning: m?.text ?? "", status: (m?.status as MeaningRow["status"]) ?? "missing" } : r)));
    setDrafts((prev) => ({ ...prev, [id]: m?.text ?? "" }));
  };

  const call = async (id: string, body: Record<string, unknown>) => {
    setBusy(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/meanings/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That didn't work. Try again.");
      apply(id, data.meaning);
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const runBatch = async () => {
    setBatch({ running: true, drafted: 0, remaining: null });
    setError("");
    let total = 0;
    try {
      for (let guard = 0; guard < 400; guard++) {
        const res = await fetch("/api/admin/meanings/batch", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Batch drafting stopped.");
        total += data.drafted;
        setBatch({ running: true, drafted: total, remaining: data.remaining });
        if (data.firstError && data.drafted === 0) throw new Error(`Claude couldn't draft: ${data.firstError}`);
        if (data.remaining === 0 || data.drafted === 0) break;
      }
      // Reload so the new drafts appear under "To review".
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Batch drafting stopped.");
    } finally {
      setBatch((b) => ({ ...b, running: false }));
    }
  };

  const chip = (active: boolean) => ({
    flex: 1,
    padding: "8px 6px",
    borderRadius: 8,
    fontSize: 12,
    border: `1px solid ${active ? COLORS.brass : COLORS.line}`,
    background: active ? alpha(COLORS.brass, 10) : "transparent",
    color: COLORS.parchment,
    cursor: "pointer",
  });
  const small = (primary = false, disabled = false) => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "7px 10px",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: primary ? 600 : 400,
    border: primary ? "none" : `1px solid ${COLORS.line}`,
    background: primary ? COLORS.brass : "transparent",
    color: primary ? COLORS.onBrass : COLORS.parchment,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
  });

  return (
    <Shell>
      <div style={{ padding: "24px 22px 28px", minHeight: 720, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <button onClick={() => router.push("/moderate")} aria-label="Back" style={{ background: "none", border: "none", color: COLORS.slate, cursor: "pointer", fontSize: 13 }}>
            ← Review submissions
          </button>
          <span style={{ fontSize: 12, color: COLORS.slate }}>{counts.approved} live</span>
        </div>
        <h2 style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 22, color: COLORS.parchment, margin: "0 0 6px" }}>Meanings</h2>
        <p style={{ fontSize: 12, color: COLORS.slate, margin: "0 0 16px", lineHeight: 1.6 }}>
          Claude drafts a plain-language meaning for each quote. Readers only see the ones you approve.
        </p>

        {!tableReady && <p style={{ color: COLORS.danger, fontSize: 13, margin: "0 0 12px" }}>Run migration 0009 in Supabase first.</p>}
        {!claudeReady && (
          <p style={{ color: COLORS.ember, fontSize: 12, margin: "0 0 12px", lineHeight: 1.6 }}>
            Claude isn&apos;t connected yet: add ANTHROPIC_API_KEY in Vercel, then redeploy. You can still write and approve meanings by hand.
          </p>
        )}

        {counts.missing > 0 && claudeReady && tableReady && (
          <button onClick={runBatch} disabled={batch.running} style={{ ...small(true, batch.running), justifyContent: "center", padding: "10px 12px", marginBottom: 16, fontSize: 13 }}>
            <Sparkles size={15} />
            {batch.running
              ? `Drafting… ${batch.drafted} done${batch.remaining !== null ? `, ${batch.remaining} to go` : ""}`
              : `Draft all ${counts.missing} missing with Claude`}
          </button>
        )}

        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          {FILTERS.map((f) => (
            <button key={f.key} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key} style={chip(filter === f.key)}>
              {f.label} ({counts[f.key]})
            </button>
          ))}
        </div>

        {error && <p style={{ color: COLORS.danger, fontSize: 12, margin: "0 0 12px" }}>{error}</p>}
        {shown.length === 0 && (
          <p style={{ color: COLORS.slate, fontSize: 13, textAlign: "center", marginTop: 40 }}>
            {filter === "draft" ? "Nothing waiting for review." : filter === "missing" ? "Every quote has a meaning." : "No meanings are live yet."}
          </p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {shown.map((r) => {
            const d = drafts[r.id] ?? "";
            const changed = d.trim() !== r.meaning.trim();
            const isBusy = busy === r.id;
            return (
              <div key={r.id} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: 14 }}>
                <span style={{ fontSize: 10, letterSpacing: 1, color: tagColor(r.tag as ContentTag) }}>{r.tag}</span>
                <p style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", color: COLORS.parchment, fontSize: 15, lineHeight: 1.45, margin: "6px 0 4px" }}>{r.text}</p>
                <p style={{ fontSize: 12, color: COLORS.slate, margin: "0 0 10px" }}>
                  {r.attributed_to}
                  {r.source ? `, ${r.source}` : ""}
                </p>

                <textarea
                  className="mf-input"
                  value={d}
                  onChange={(e) => setDrafts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder={r.status === "missing" ? "No meaning yet. Draft one with Claude or write it here." : ""}
                  rows={4}
                  aria-label="Meaning"
                  style={{ resize: "vertical", marginBottom: 6, fontSize: 14, lineHeight: 1.55 }}
                />
                <div style={{ fontSize: 11, color: words(d) > 90 ? COLORS.ember : COLORS.slate, margin: "0 2px 10px" }}>
                  {words(d)} words{r.status === "approved" ? " · live" : r.status === "draft" ? " · draft" : ""}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    disabled={isBusy || !d.trim() || (r.status === "approved" && !changed)}
                    onClick={() => call(r.id, { action: "save", text: d, approve: true })}
                    style={small(true, isBusy || !d.trim() || (r.status === "approved" && !changed))}
                  >
                    <Check size={14} /> {r.status === "approved" ? "Save changes" : "Approve"}
                  </button>
                  {claudeReady && (
                    <button disabled={isBusy} onClick={() => call(r.id, { action: "draft" })} style={small(false, isBusy)}>
                      {r.status === "missing" ? <Sparkles size={14} /> : <RotateCcw size={14} />}
                      {isBusy ? "Working…" : r.status === "missing" ? "Draft with Claude" : "Redraft"}
                    </button>
                  )}
                  {r.status === "draft" && changed && (
                    <button disabled={isBusy} onClick={() => call(r.id, { action: "save", text: d, approve: false })} style={small(false, isBusy)}>
                      Save draft
                    </button>
                  )}
                  {r.status === "approved" && (
                    <button disabled={isBusy} onClick={() => call(r.id, { action: "unapprove" })} style={small(false, isBusy)}>
                      <EyeOff size={14} /> Hide from readers
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}
