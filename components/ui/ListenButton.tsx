"use client";

import type { CSSProperties, MouseEvent } from "react";
import { AudioLines, Square } from "lucide-react";
import { COLORS } from "@/lib/constants";

interface ListenButtonProps {
  active: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  size?: number;
  style?: CSSProperties;
}

// Read-aloud toggle: sound-wave icon to start, a stop square (with a soft
// pulsing ring) while the quote is being read.
export function ListenButton({ active, onClick, size = 24, style }: ListenButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={active ? "Stop reading aloud" : "Read aloud"}
      aria-pressed={active}
      title={active ? "Stop" : "Read aloud"}
      style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", justifyContent: "center", ...style }}
    >
      <style>{`
        @keyframes mf-listen-kf { 0% { transform: scale(0.8); opacity: 0.7; } 100% { transform: scale(1.6); opacity: 0; } }
        .mf-listen-ring { position: absolute; inset: 0; margin: auto; border-radius: 50%; border: 1.5px solid var(--brass); animation: mf-listen-kf 1.4s ease-out infinite; pointer-events: none; }
        @media (prefers-reduced-motion: reduce) { .mf-listen-ring { animation: none; opacity: 0.6; } }
      `}</style>
      {active && <span aria-hidden className="mf-listen-ring" style={{ width: size + 8, height: size + 8 }} />}
      {active ? <Square size={size - 6} color={COLORS.brass} fill={COLORS.brass} /> : <AudioLines size={size} color={COLORS.parchment} />}
    </button>
  );
}
