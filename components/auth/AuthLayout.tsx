"use client";

import type { ReactNode } from "react";
import { Shell, Logo } from "@/components/ui/Shell";
import { InkQuote } from "@/components/auth/InkQuote";
import { COLORS, alpha } from "@/lib/constants";

interface AuthLayoutProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  compact?: boolean; // shorter stage for long forms (sign-up)
}

// Shared frame for sign-in, sign-up and password screens: a stage where a
// line writes itself over a rising brass dawn, and a sheet holding the form.
const HORIZON = 30; // px from the bottom of the stage

export function AuthLayout({ title, subtitle, children, compact = false }: AuthLayoutProps) {
  const stageH = compact ? 250 : 350;
  return (
    <Shell>
      <style>{AUTH_CSS}</style>
      <div style={{ minHeight: 720, display: "flex", flexDirection: "column" }}>
        {/* Stage */}
        <div className="au-stage" style={{ position: "relative", height: stageH, padding: "26px 28px 0", overflow: "hidden", flexShrink: 0 }}>
          {/* Dawn: a brass sun rising from behind a horizon line, with a faint glow around it */}
          <div aria-hidden className="au-sun" style={{ position: "absolute", left: "50%", bottom: -150, width: 380, height: 380, marginLeft: -190, borderRadius: "50%", background: `radial-gradient(circle, ${alpha(COLORS.brass, 34)} 0%, ${alpha(COLORS.brass, 12)} 42%, ${alpha(COLORS.brass, 0)} 70%)` }} />
          <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: HORIZON, height: 150, overflow: "hidden" }}>
            <div aria-hidden className="au-sun-core" style={{ position: "absolute", left: "50%", bottom: -52, width: 104, height: 104, marginLeft: -52, borderRadius: "50%", background: "radial-gradient(circle at 50% 40%, var(--au-sun) 0%, var(--au-sun) 58%, transparent 72%)", boxShadow: `0 0 60px 18px ${alpha(COLORS.brass, 22)}` }} />
          </div>
          <div aria-hidden className="au-horizon" style={{ position: "absolute", left: 0, right: 0, bottom: HORIZON, height: 1, background: `linear-gradient(90deg, ${alpha(COLORS.brass, 0)}, ${alpha(COLORS.brass, 80)}, ${alpha(COLORS.brass, 0)})` }} />
          {/* Its reflection below the line */}
          <div aria-hidden className="au-horizon" style={{ position: "absolute", left: "50%", bottom: HORIZON - 26, width: 150, height: 26, marginLeft: -75, background: `radial-gradient(ellipse at 50% 0%, ${alpha(COLORS.brass, 22)}, ${alpha(COLORS.brass, 0)} 70%)` }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <Logo />
          </div>
          <div style={{ position: "relative", zIndex: 1, marginTop: compact ? 22 : 54, maxWidth: 330 }}>
            <InkQuote size={compact ? 21 : 26} />
          </div>
        </div>

        {/* Sheet */}
        <div
          className="au-sheet"
          style={{
            position: "relative",
            zIndex: 2,
            flex: 1,
            marginTop: -2,
            background: COLORS.ink2,
            borderRadius: "22px 22px 0 0",
            borderTop: `1px solid ${COLORS.line}`,
            padding: "26px 28px 28px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <h1 style={{ fontFamily: "'Newsreader', serif", fontWeight: 500, fontSize: 28, lineHeight: 1.15, color: COLORS.parchment, margin: 0 }}>{title}</h1>
          {subtitle && <p style={{ color: COLORS.slate, fontSize: 13, lineHeight: 1.6, margin: "6px 0 0" }}>{subtitle}</p>}
          <div style={{ marginTop: 22, flex: 1, display: "flex", flexDirection: "column" }}>{children}</div>
        </div>
      </div>
    </Shell>
  );
}

const AUTH_CSS = `
.au-stage { --au-sun: var(--brass); }
[data-theme="light"] .au-stage { --au-sun: var(--brassDim); }
@keyframes au-ink-kf { from { opacity: 0; filter: blur(5px); transform: translateY(3px); } to { opacity: 1; filter: blur(0); transform: none; } }
.au-ink { display: inline-block; opacity: 0; animation: au-ink-kf 520ms cubic-bezier(.2,.7,.2,1) forwards; }
@keyframes au-fade-kf { from { opacity: 0; } to { opacity: 1; } }
.au-fade { opacity: 0; animation: au-fade-kf 700ms ease forwards; }

@keyframes au-rise-kf { from { transform: translateY(110px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes au-glow-kf { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: none; } }
@keyframes au-breathe-kf { from { transform: scale(1); } to { transform: scale(1.06); } }
.au-sun { animation: au-glow-kf 2.6s ease-out both, au-breathe-kf 7s ease-in-out 2.6s infinite alternate; }
.au-sun-core { animation: au-rise-kf 2.4s cubic-bezier(.16,.8,.24,1) both; }
@keyframes au-line-kf { from { transform: scaleX(0); opacity: 0; } to { transform: scaleX(1); opacity: 1; } }
.au-horizon { transform-origin: center; animation: au-line-kf 1.4s ease-out 0.3s both; }

@keyframes au-sheet-kf { from { transform: translateY(40px); opacity: 0; } to { transform: none; opacity: 1; } }
.au-sheet { animation: au-sheet-kf 700ms cubic-bezier(.2,.8,.2,1) 0.15s both; }

.au-field { position: relative; margin-bottom: 14px; }
.au-label { display: block; font-size: 12px; color: var(--slate); margin: 0 0 6px 2px; }
.au-input {
  width: 100%; box-sizing: border-box; background: var(--ink); color: var(--parchment);
  border: 1px solid var(--line); border-radius: 12px; padding: 13px 14px; font-size: 15px;
  font-family: 'Space Grotesk', sans-serif; outline: none;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.au-input::placeholder { color: var(--placeholder); }
.au-input:focus { border-color: var(--brass); box-shadow: 0 0 0 4px color-mix(in srgb, var(--brass) 18%, transparent); }
.au-input.has-trail { padding-right: 46px; }
.au-trail { position: absolute; right: 6px; bottom: 6px; width: 36px; height: 36px; border: none; background: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--slate); }
.au-trail:hover { color: var(--parchment); }
.au-trail:focus-visible, .au-link:focus-visible, .au-btn:focus-visible, .au-choice:focus-visible { outline: 2px solid var(--brass); outline-offset: 2px; }
.au-hint { font-size: 11px; color: var(--slate); margin: 6px 2px 0; line-height: 1.5; }

.au-btn {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 14px 16px; border-radius: 12px; border: none; background: var(--brass); color: #14110F;
  font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer;
  transition: transform 120ms ease, opacity 160ms ease, filter 160ms ease;
}
.au-btn:hover:not(:disabled) { filter: brightness(1.06); }
.au-btn:active:not(:disabled) { transform: scale(0.98); }
.au-btn:disabled { opacity: 0.45; cursor: default; }
.au-spinner { width: 16px; height: 16px; border-radius: 50%; border: 2px solid rgba(20,17,15,.25); border-top-color: #14110F; animation: mf-spin-kf 0.8s linear infinite; }

.au-link { color: var(--brass); text-decoration: none; border-radius: 4px; }
.au-link:hover { text-decoration: underline; text-underline-offset: 3px; }

@keyframes au-shake-kf { 0%,100% { transform: none; } 20% { transform: translateX(-6px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
.au-error { color: var(--danger); font-size: 13px; line-height: 1.5; margin: 2px 2px 14px; animation: au-shake-kf 360ms ease; }

.au-choice { text-align: left; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--line); background: transparent; cursor: pointer; transition: border-color 160ms ease, background 160ms ease; }
.au-choice[aria-pressed="true"] { border-color: var(--brass); background: color-mix(in srgb, var(--brass) 9%, transparent); }

@media (prefers-reduced-motion: reduce) {
  .au-ink, .au-fade, .au-sun, .au-sun-core, .au-horizon, .au-sheet, .au-error { animation: none !important; opacity: 1 !important; transform: none !important; filter: none !important; }
  .au-btn, .au-input { transition: none; }
}
`;
