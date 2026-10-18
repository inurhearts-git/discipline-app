"use client";

import { useEffect, useRef, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { COLORS, alpha } from "@/lib/constants";

// Approved meanings already opened this session, by content id.
const cache = new Map<string, string>();

// Small "What it means" link shown under a quote that has an approved meaning.
export function MeaningLink({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      style={{
        alignSelf: "flex-start",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginTop: 14,
        padding: "6px 11px",
        borderRadius: 14,
        border: `1px solid ${alpha(COLORS.brass, 45)}`,
        background: alpha(COLORS.ink, 40),
        color: COLORS.brass,
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      <Lightbulb size={13} aria-hidden /> What it means
    </button>
  );
}

// Minimal popup with the plain-language meaning of a quote. Close only.
export function MeaningSheet({ contentId, onClose }: { contentId: string; onClose: () => void }) {
  const [text, setText] = useState<string | null>(cache.get(contentId) ?? null);
  const [failed, setFailed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (cache.has(contentId)) return;
    let cancelled = false;
    fetch(`/api/meaning/${contentId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { text: string }) => {
        cache.set(contentId, d.text);
        if (!cancelled) setText(d.text);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [contentId]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="meaning-title"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      style={{ position: "absolute", inset: 0, zIndex: 60, background: alpha(COLORS.ink, 72), display: "flex", alignItems: "center", justifyContent: "center", padding: 22 }}
    >
      <style>{`
        @keyframes mf-meaning-in { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }
        .mf-meaning { animation: mf-meaning-in 220ms ease-out both; }
        .mf-meaning-close { outline: none; }
        .mf-meaning-close:focus-visible { outline: 2px solid var(--brass); outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { .mf-meaning { animation: none; } }
      `}</style>
      <div
        className="mf-meaning"
        onClick={(e) => e.stopPropagation()}
        style={{ position: "relative", width: "100%", maxWidth: 340, background: COLORS.ink2, border: `1px solid ${COLORS.line}`, borderRadius: 16, padding: "20px 20px 22px", boxShadow: `0 18px 50px ${alpha("#000000", 35)}` }}
      >
        <button
          ref={closeRef}
          className="mf-meaning-close"
          onClick={onClose}
          aria-label="Close"
          style={{ position: "absolute", top: 10, right: 10, width: 34, height: 34, borderRadius: "50%", border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <X size={18} color={COLORS.slate} />
        </button>
        <div id="meaning-title" style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: COLORS.brass, marginBottom: 12, paddingRight: 30 }}>
          <Lightbulb size={14} aria-hidden /> What it means
        </div>
        {text ? (
          <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: COLORS.parchment }}>{text}</p>
        ) : failed ? (
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: COLORS.slate }}>Couldn&apos;t load the meaning. Check your connection and try again.</p>
        ) : (
          <div aria-label="Loading" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[100, 92, 70].map((w) => (
              <span key={w} style={{ height: 12, width: `${w}%`, borderRadius: 6, background: alpha(COLORS.parchment, 8) }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
