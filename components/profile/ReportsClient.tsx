"use client";

import { useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/ui/Shell";
import { COLORS, alpha } from "@/lib/constants";

export interface ReportRow {
  id: string;
  contentId: string;
  reason: string;
  note: string | null;
  createdAt: string;
  text: string;
  attributedTo: string;
  source: string | null;
  tag: string;
}

const REASON_LABEL: Record<string, string> = {
  wrong_source: "Wrong person or source",
  inaccurate: "Wording is wrong or changed",
  inappropriate: "Inappropriate or offensive",
  broken_video: "Video won't play",
  other: "Something else",
};

export function ReportsClient({ initial }: { initial: ReportRow[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const act = async (row: ReportRow, action: "resolve" | "remove") => {
    if (action === "remove" && !window.confirm("Take this item out of the feed?")) return;
    setBusy(row.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/reports/${row.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "That didn't work. Try again.");
        return;
      }
      // Removing an item closes every report about it; resolving closes this one.
      setRows((prev) => prev.filter((r) => (action === "remove" ? r.contentId !== row.contentId : r.id !== row.id)));
    } catch {
      setError("That didn't work. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const btn = { padding: "7px 12px", borderRadius: 8, fontSize: 12, cursor: "pointer", border: `1px solid ${COLORS.line}`, background: "none", color: COLORS.parchment } as const;

  return (
    <Shell>
      <div style={{ padding: "24px 22px 32px" }}>
        <Link href="/profile" style={{ color: COLORS.slate, fontSize: 13, textDecoration: "none" }}>
          ← Profile
        </Link>
        <h1 style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontWeight: 400, fontSize: 28, color: COLORS.parchment, margin: "16px 0 6px" }}>Reported errors</h1>
        <p style={{ margin: "0 0 18px", fontSize: 12, color: COLORS.slate }}>{rows.length === 0 ? "Nothing open." : `${rows.length} open`}</p>
        {error && <p style={{ color: COLORS.danger, fontSize: 12, margin: "0 0 12px" }}>{error}</p>}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((r) => (
            <div key={r.id} style={{ border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 14 }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: COLORS.brass }}>{REASON_LABEL[r.reason] ?? r.reason}</p>
              {r.note && <p style={{ margin: "0 0 8px", fontSize: 13, color: COLORS.parchment, lineHeight: 1.5 }}>&ldquo;{r.note}&rdquo;</p>}
              <div style={{ borderLeft: `2px solid ${alpha(COLORS.brass, 50)}`, paddingLeft: 10, margin: "8px 0 12px" }}>
                <p style={{ margin: "0 0 4px", fontSize: 13, lineHeight: 1.5, color: COLORS.parchment }}>{r.text}</p>
                <p style={{ margin: 0, fontSize: 11, color: COLORS.slate }}>
                  {r.attributedTo}
                  {r.source ? ` · ${r.source}` : ""} · {r.tag}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={btn} disabled={busy === r.id} onClick={() => act(r, "resolve")}>
                  Keep and close
                </button>
                <button style={{ ...btn, color: COLORS.danger, borderColor: alpha(COLORS.danger, 50) }} disabled={busy === r.id} onClick={() => act(r, "remove")}>
                  Remove from feed
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}
