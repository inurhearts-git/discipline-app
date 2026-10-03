import { COLORS } from "@/lib/constants";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/ui/BottomNav";

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 420,
        margin: "0 auto",
        background: COLORS.ink,
        fontFamily: "'Space Grotesk', sans-serif",
        position: "relative",
        borderRadius: 20,
        overflow: "hidden",
        boxShadow: "0 0 0 1px rgba(246,241,231,0.08)",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;1,400;1,500&family=Space+Grotesk:wght@400;500;600&display=swap');
        .mf-scroll::-webkit-scrollbar { display: none; }
        .mf-scroll { scrollbar-width: none; }
        .mf-input {
          width: 100%; box-sizing: border-box; background: rgba(246,241,231,0.05);
          border: 1px solid rgba(246,241,231,0.18); color: #F6F1E7; border-radius: 8px;
          padding: 11px 12px; font-size: 14px; font-family: 'Space Grotesk', sans-serif;
          margin-bottom: 12px; outline: none;
        }
        .mf-input::placeholder { color: #6f6a60; }
        .mf-input:focus { border-color: #C9A227; }
        .mf-label { font-size: 11px; letter-spacing: 1px; color: #9C968A; margin: 0 0 6px; display:block; text-transform: uppercase; }
        .mf-spin { animation: mf-spin-kf 1s linear infinite; }
        @keyframes mf-spin-kf { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
      {/* Wrapper keeps every page's absolute-positioned elements inside the content area, above the tab bar */}
      <div style={{ position: "relative", minHeight: 720 }}>{children}</div>
      <BottomNav />
    </div>
  );
}

export function Logo() {
  return (
    <span style={{ fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 22, color: COLORS.parchment }}>
      Discipline
    </span>
  );
}
