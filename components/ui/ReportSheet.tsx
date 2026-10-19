"use client";

import { useEffect, useRef, useState } from "react";
import { Flag, X } from "lucide-react";
import { COLORS, alpha } from "@/lib/constants";

const REASONS = [
  { id: "wrong_source", label: "Wrong person or source" },
  { id: "inaccurate", label: "Wording is wrong or changed" },
  { id: "inappropriate", label: "Inappropriate or offensive" },
  { id: "broken_video", label: "Video won't play" },
  { id: "other", label: "Something else" },
] as const;

// Small popup for "Report an error" on a quote, scripture or clip.
export function ReportSheet({ contentId, onClose }: { contentId: string; onClose: () => void }) {
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = async () => {
    if (!reason || state === "sending") return;
    setState("sending");
    setError("");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_id: contentId, reason, note }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't send your report. Please try again.");
        setState("idle");
        return;
      }
      setState("sent");
    } catch {
      setError("Couldn't send your report. Check your connection and try again.");
      setState("idle");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      style={{ position: "absolute", inset: 0, zIndex: 60, background: alpha(COLORS.ink, 72), display: "flex", alignItems: "center", justifyContent: "center", padding: 22 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", width: "100%", maxWidth: 340, background: COLORS.ink2, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: "20px 20px 20px", boxShadow: `0 18px 50px ${alpha("#000000", 35)}` }}
      >
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close"
          style={{ position: "absolute", top: 10, right: 10, width: 34, height: 34, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <X size={18} color={COLORS.slate} />
        </button>
        <div id="report-title" style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: COLORS.brass, marginBottom: 12, paddingRight: 30 }}>
          <Flag size={14} aria-hidden /> Report an error
        </div>

        {state === "sent" ? (
          <>
            <p style={{ margin: "0 0 14px", fontSize: 15, lineHeight: 1.6, color: COLORS.parchment }}>Thank you. We&apos;ll check it and fix or remove it.</p>
            <button onClick={onClose} style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "none", color: COLORS.parchment, fontSize: 13, cursor: "pointer" }}>
              Close
            </button>
          </>
        ) : (
          <>
            <div role="radiogroup" aria-label="What's wrong?" style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  role="radio"
                  aria-checked={reason === r.id}
                  onClick={() => setReason(r.id)}
                  style={{ textAlign: "left", padding: "9px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer", color: COLORS.parchment, border: `1px solid ${reason === r.id ? COLORS.brass : COLORS.line}`, background: reason === r.id ? alpha(COLORS.brass, 10) : "transparent" }}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              placeholder="Anything we should know? (optional)"
              rows={2}
              className="mf-input"
              style={{ resize: "none", marginBottom: 10 }}
            />
            {error && <p style={{ margin: "0 0 10px", fontSize: 12, color: COLORS.danger }}>{error}</p>}
            <button
              onClick={send}
              disabled={!reason || state === "sending"}
              style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: COLORS.brass, color: COLORS.onBrass, fontSize: 13, fontWeight: 500, cursor: reason ? "pointer" : "default", opacity: reason && state !== "sending" ? 1 : 0.4 }}
            >
              {state === "sending" ? "Sending…" : "Send report"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
