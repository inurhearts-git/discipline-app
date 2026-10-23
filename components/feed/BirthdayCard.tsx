"use client";

import { useState } from "react";
import { Share2, Copy, Check } from "lucide-react";
import { COLORS, alpha } from "@/lib/constants";

export interface BirthdayCard {
  key: string; // "self" or the birthday's id
  kind: "self" | "other";
  title: string;
  body: string;
  quote: string;
}

const SEEN_KEY = "mf-bday-seen"; // {"day":"2026-10-24","keys":["self","…"]}

export function seenToday(day: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "{}") as { day?: string; keys?: string[] };
    return v.day === day && Array.isArray(v.keys) ? v.keys : [];
  } catch {
    return [];
  }
}

export function markSeen(day: string, key: string): void {
  try {
    const keys = Array.from(new Set([...seenToday(day), key]));
    localStorage.setItem(SEEN_KEY, JSON.stringify({ day, keys }));
  } catch {
    // ignore
  }
}

// One birthday card over the feed: yours ("Happy birthday") or someone's
// you added on Profile ("It's your spouse's birthday today"), with a quote
// to share. Shown after the mood picker.
export function BirthdayOverlay({ card, onClose }: { card: BirthdayCard; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const wish = `Happy birthday! 🎂\n\n“${card.quote}”`;

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ text: wish });
        return;
      }
    } catch {
      return; // share sheet closed
    }
    copy();
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(wish);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked: nothing else to do
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label={card.title} style={{ position: "absolute", inset: 0, zIndex: 44, background: alpha(COLORS.ink, 95), display: "flex", alignItems: "center", justifyContent: "center", padding: 22 }}>
      <style dangerouslySetInnerHTML={{ __html: `@keyframes mf-bday{from{transform:scale(.85);opacity:0}to{transform:scale(1);opacity:1}}@media (prefers-reduced-motion:no-preference){.mf-bday{animation:mf-bday .45s cubic-bezier(.2,.9,.3,1.15) both}}` }} />
      <div className="mf-bday" style={{ width: "100%", maxWidth: 360, borderRadius: 18, padding: "26px 22px 20px", background: COLORS.ink2, border: `1px solid ${alpha(COLORS.brass, 45)}`, textAlign: "center" }}>
        <div aria-hidden="true" style={{ fontSize: 46, lineHeight: 1, marginBottom: 12 }}>
          {card.kind === "self" ? "🎉" : "🎂"}
        </div>
        <p style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.35, color: COLORS.parchment, margin: "0 0 6px" }}>{card.title.replace(/\s*🎂$/u, "")}</p>
        <p style={{ fontSize: 13, lineHeight: 1.5, color: COLORS.slate, margin: "0 0 18px" }}>{card.body}</p>
        <blockquote style={{ margin: "0 0 22px", padding: "16px 14px", borderRadius: 12, background: alpha(COLORS.brass, 9), fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: 20, lineHeight: 1.4, color: COLORS.parchment }}>
          “{card.quote}”
        </blockquote>
        {card.kind === "other" ? (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button type="button" onClick={share} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px", borderRadius: 10, border: "none", background: COLORS.brass, color: COLORS.onBrass, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
                <Share2 size={15} /> Send wish
              </button>
              <button type="button" onClick={copy} aria-label="Copy the wish" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "11px 14px", borderRadius: 10, border: `1px solid ${COLORS.line}`, background: "transparent", color: COLORS.parchment, fontSize: 14, cursor: "pointer" }}>
                {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: COLORS.slate, fontSize: 13, cursor: "pointer", padding: 6 }}>
              Done
            </button>
          </>
        ) : (
          <button type="button" onClick={onClose} style={{ width: "100%", padding: "11px", borderRadius: 10, border: "none", background: COLORS.brass, color: COLORS.onBrass, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Thank you
          </button>
        )}
      </div>
    </div>
  );
}
