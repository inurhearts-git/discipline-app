"use client";

import { Fragment, useEffect, useState } from "react";
import { Sun } from "lucide-react";
import { COLORS } from "@/lib/constants";

// Fallback lines (public domain) for when the quote of the day isn't available.
const QUOTES = [
  { text: "Waste no more time arguing what a good man should be. Be one.", by: "Marcus Aurelius" },
  { text: "We suffer more often in imagination than in reality.", by: "Seneca" },
  { text: "Go to the ant, thou sluggard; consider her ways, and be wise.", by: "Proverbs 6:6" },
  { text: "No man is free who is not master of himself.", by: "Epictetus" },
  { text: "Your business is with action alone; not by any means with fruit.", by: "Bhagavad Gita 2.47" },
  { text: "Well begun is half done.", by: "Aristotle" },
];

const CHAR_MS = 32; // gap between letters appearing
const MAX_WRITE_MS = 3600; // long passages ink faster so they never drag
const HOLD_MS = 4200; // how long a finished line stays (rotating mode)
const FADE_MS = 700;

export interface InkQuoteItem {
  text: string;
  by: string;
}

// Type size by length, so short lines feel big and long scripture still fits.
function sizeFor(len: number, compact: boolean): number {
  const base = len <= 40 ? 30 : len <= 70 ? 26 : len <= 120 ? 23 : len <= 200 ? 20 : len <= 320 ? 18 : 16;
  return compact ? Math.max(15, base - 4) : base;
}

// Each letter fades in from a slight blur, like ink settling.
// With `daily`, today's quote of the day is written once and stays.
// Without it (no quote available), a few public-domain lines take turns.
// With reduced motion, the text simply appears with no per-letter animation.
export function InkQuote({ daily, compact = false }: { daily?: InkQuoteItem | null; compact?: boolean }) {
  const list = daily ? [daily] : QUOTES;
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    try {
      setStill(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    } catch {
      /* older browsers: animate */
    }
  }, []);

  const q = list[index % list.length];
  const charMs = Math.min(CHAR_MS, MAX_WRITE_MS / Math.max(1, q.text.length));
  const writeMs = still ? 0 : q.text.length * charMs + 500;

  useEffect(() => {
    if (daily) return; // the quote of the day stays put
    const t1 = setTimeout(() => setLeaving(true), writeMs + HOLD_MS);
    const t2 = setTimeout(() => {
      setLeaving(false);
      setIndex((i) => (i + 1) % QUOTES.length);
    }, writeMs + HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [index, writeMs, daily]);

  const size = sizeFor(q.text.length, compact);
  const authorDelay = still ? 0 : q.text.length * charMs + 150;

  return (
    <figure
      aria-live="off"
      style={{ margin: 0, opacity: leaving ? 0 : 1, transition: `opacity ${FADE_MS}ms ease`, minHeight: daily ? undefined : size * 1.35 * 3 + 30 }}
    >
      {daily && (
        <div className={still ? undefined : "au-fade"} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, fontSize: 12, color: COLORS.brass }}>
          <Sun size={13} aria-hidden /> Quote of the day
        </div>
      )}
      <blockquote
        key={index}
        aria-label={`${q.text} (${q.by})`}
        style={{ margin: 0, fontFamily: "'Newsreader', serif", fontStyle: "italic", fontSize: size, lineHeight: 1.35, color: COLORS.parchment }}
      >
        {still
          ? q.text
          : q.text.split(" ").map((word, w, words) => {
              const before = words.slice(0, w).join(" ").length + (w ? 1 : 0);
              return (
                // Words stay whole so lines only break at the spaces between them.
                <Fragment key={w}>
                  <span aria-hidden style={{ whiteSpace: "nowrap" }}>
                    {Array.from(word).map((ch, c) => (
                      <span key={c} className="au-ink" style={{ animationDelay: `${(before + c) * charMs}ms` }}>
                        {ch}
                      </span>
                    ))}
                  </span>
                  {w < words.length - 1 ? " " : null}
                </Fragment>
              );
            })}
      </blockquote>
      <figcaption
        key={`by-${index}`}
        aria-hidden
        className={still ? undefined : "au-fade"}
        style={{ marginTop: 14, fontSize: 13, color: COLORS.slate, animationDelay: `${authorDelay}ms` }}
      >
        {q.by}
      </figcaption>
    </figure>
  );
}
