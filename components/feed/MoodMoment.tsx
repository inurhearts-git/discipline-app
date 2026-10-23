"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { COLORS, alpha } from "@/lib/constants";
import { MOMENTS, momentSeconds } from "@/lib/mood-moments";
import type { MoodId } from "@/lib/moods";

// The offer shown after picking a mood: start the moment, or not now.
export function MomentOffer({ mood, onStart, onClose }: { mood: MoodId; onStart: () => void; onClose: () => void }) {
  const m = MOMENTS[mood];
  return (
    <div role="dialog" aria-label={m.name} style={{ position: "absolute", left: 14, right: 14, bottom: 18, zIndex: 41, borderRadius: 16, padding: 18, background: COLORS.ink2, border: `1px solid ${alpha(COLORS.brass, 45)}` }}>
      <p style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 22, color: COLORS.parchment, margin: "0 0 4px" }}>{m.name} first?</p>
      <p style={{ fontSize: 13, lineHeight: 1.5, color: COLORS.slate, margin: "0 0 14px" }}>{m.invite}</p>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={onStart} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: COLORS.brass, color: COLORS.onBrass, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
          Start
        </button>
        <button type="button" onClick={onClose} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `1px solid ${COLORS.line}`, background: "transparent", color: COLORS.parchment, fontSize: 14, cursor: "pointer" }}>
          Not now
        </button>
      </div>
    </div>
  );
}

function useReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const q = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!q) return;
    setR(q.matches);
    const on = () => setR(q.matches);
    q.addEventListener?.("change", on);
    return () => q.removeEventListener?.("change", on);
  }, []);
  return r;
}

// The moment itself: full screen over the feed. Pauses when the app is in
// the background; X ends it at any time.
export function MoodMomentPlayer({ mood, onClose }: { mood: MoodId; onClose: () => void }) {
  const m = MOMENTS[mood];
  const total = momentSeconds(m);
  const reduced = useReducedMotion();
  const [elapsed, setElapsed] = useState(0); // ms
  const [running, setRunning] = useState(true);
  const last = useRef<number | null>(null);
  // The circle starts small, so the first "Breathe in" grows it.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setStarted(true)));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const tick = (t: number) => {
      if (document.visibilityState === "visible") {
        // Work out the step now: the state updater runs later, after last.current moves on.
        const d = last.current !== null ? t - last.current : 0;
        last.current = t;
        if (d > 0) setElapsed((e) => Math.min(total * 1000, e + Math.min(d, 1000)));
      } else last.current = null;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      last.current = null;
    };
  }, [running, total]);

  const finished = elapsed >= total * 1000;
  useEffect(() => {
    if (finished) setRunning(false);
  }, [finished]);

  // Which step, and how far into it.
  let acc = 0;
  let index = 0;
  for (; index < m.steps.length - 1; index++) {
    if (elapsed < (acc + m.steps[index].seconds) * 1000) break;
    acc += m.steps[index].seconds;
  }
  const step = m.steps[index];
  const intoStep = (elapsed - acc * 1000) / 1000;
  const left = Math.max(1, Math.ceil(step.seconds - intoStep));
  const breathing = mood === "stressed";
  const breathNo = Math.floor(index / 2) + 1;
  const ringFrac = Math.min(1, elapsed / (total * 1000));

  // Breathing circle: grows over the 6 s in, shrinks over the 6 s out.
  const scale = breathing ? (started && step.phase === "in" ? 1 : 0.55) : 1;

  const again = () => {
    setStarted(false);
    setElapsed(0);
    setRunning(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setStarted(true)));
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={m.name} style={{ position: "absolute", inset: 0, zIndex: 46, background: COLORS.ink, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 28, textAlign: "center" }}>
      <button type="button" onClick={onClose} aria-label={finished ? "Close" : "Skip"} style={{ position: "absolute", top: 18, right: 18, background: "none", border: "none", cursor: "pointer", padding: 6, color: COLORS.slate, display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
        {finished ? null : "Skip"} <X size={18} />
      </button>
      <p style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: COLORS.brass, margin: "0 0 26px" }}>{m.name}</p>

      {!finished ? (
        <>
          <div style={{ position: "relative", width: 230, height: 230, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
            <svg width="230" height="230" viewBox="0 0 230 230" style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }} aria-hidden="true">
              <circle cx="115" cy="115" r="108" fill="none" stroke={COLORS.line} strokeWidth="3" />
              <circle cx="115" cy="115" r="108" fill="none" stroke={COLORS.brass} strokeWidth="3" strokeLinecap="round" strokeDasharray={2 * Math.PI * 108} strokeDashoffset={2 * Math.PI * 108 * (1 - ringFrac)} />
            </svg>
            <div
              style={{
                width: 170,
                height: 170,
                borderRadius: "50%",
                background: alpha(COLORS.brass, breathing ? 22 : 12),
                border: `1px solid ${alpha(COLORS.brass, 55)}`,
                transform: `scale(${reduced ? 1 : scale})`,
                transition: reduced || !breathing ? "none" : `transform ${step.seconds}s ease-in-out`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontFamily: "'Newsreader', serif", fontSize: 40, color: COLORS.parchment }} aria-live="off">
                {left}
              </span>
            </div>
          </div>
          <p aria-live="polite" style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: breathing ? 30 : 24, lineHeight: 1.3, color: COLORS.parchment, margin: "0 0 10px", minHeight: 64, maxWidth: 320 }}>
            {step.text}
          </p>
          <p style={{ fontSize: 12, color: COLORS.slate, margin: 0 }}>{breathing ? `Breath ${breathNo} of 10` : `${index + 1} of ${m.steps.length}`}</p>
        </>
      ) : (
        <>
          <p style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 28, lineHeight: 1.3, color: COLORS.parchment, margin: "0 0 24px", maxWidth: 320 }}>{m.done}</p>
          <button type="button" onClick={onClose} style={{ padding: "12px 22px", borderRadius: 12, border: "none", background: COLORS.brass, color: COLORS.onBrass, fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 10 }}>
            Back to my feed
          </button>
          <button type="button" onClick={again} style={{ background: "none", border: "none", color: COLORS.slate, fontSize: 13, cursor: "pointer" }}>
            Do it again
          </button>
        </>
      )}
    </div>
  );
}
