"use client";

import { useState, type CSSProperties } from "react";
import { Download, X } from "lucide-react";
import { COLORS } from "@/lib/constants";
import { Btn } from "@/components/ui/Btn";

type Format = "txt" | "md";
type Order = "newest" | "oldest";

// "Export" link on the journal page. Opens a small panel to pick the format,
// order and an optional date range, then downloads the file.
export function ExportJournal() {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("txt");
  const [order, setOrder] = useState<Order>("oldest");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setMsg(null);
    try {
      const params = new URLSearchParams({ format, order, tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/journal/export?${params}`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setMsg(body.error ?? "Couldn't export. Try again.");
        return;
      }
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? `journal.${format}`;
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      setMsg("Downloaded.");
    } catch {
      setMsg("Couldn't export. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "none", border: "none", padding: 0, color: COLORS.slate, fontSize: 12, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3 }}
      >
        <Download size={14} /> Export
      </button>
    );
  }

  const label: CSSProperties = { fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: COLORS.slate, marginBottom: 6 };
  const dateInput: CSSProperties = {
    flex: 1,
    minWidth: 0,
    padding: "8px 10px",
    borderRadius: 8,
    border: `1px solid ${COLORS.line}`,
    background: "transparent",
    color: COLORS.parchment,
    fontSize: 13,
    colorScheme: "light dark",
  };

  return (
    <div style={{ border: `1px solid ${COLORS.line}`, borderRadius: 10, padding: "14px 16px", marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 14, color: COLORS.parchment, fontWeight: 500 }}>Export your journal</span>
        <button type="button" aria-label="Close" onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: COLORS.slate, cursor: "pointer", padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={label}>Format</div>
        <Segmented
          value={format}
          onChange={setFormat}
          options={[
            ["txt", "Plain text"],
            ["md", "Markdown"],
          ]}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={label}>Order</div>
        <Segmented
          value={order}
          onChange={setOrder}
          options={[
            ["oldest", "Oldest first"],
            ["newest", "Newest first"],
          ]}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={label}>Dates (optional)</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="date" aria-label="From" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={dateInput} />
          <span style={{ color: COLORS.slate, fontSize: 12 }}>to</span>
          <input type="date" aria-label="To" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={dateInput} />
        </div>
        <p style={{ fontSize: 11, color: COLORS.slate, margin: "6px 0 0" }}>Leave empty for every entry.</p>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Btn variant="primary" onClick={download} disabled={busy}>
          <Download size={15} /> {busy ? "Preparing…" : "Download"}
        </Btn>
        {msg && <span style={{ fontSize: 12, color: msg === "Downloaded." ? COLORS.sage : COLORS.danger }}>{msg}</span>}
      </div>
      <p style={{ fontSize: 11, color: COLORS.slate, margin: "12px 0 0", lineHeight: 1.5 }}>
        The file has only your own entries. Keep it somewhere safe, since anyone with the file can read it.
      </p>
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div role="radiogroup" style={{ display: "inline-flex", border: `1px solid ${COLORS.line}`, borderRadius: 8, overflow: "hidden" }}>
      {options.map(([v, text]) => {
        const on = v === value;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(v)}
            style={{
              padding: "7px 12px",
              fontSize: 13,
              border: "none",
              cursor: "pointer",
              background: on ? COLORS.brass : "transparent",
              color: on ? COLORS.onBrass : COLORS.parchment,
            }}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}
