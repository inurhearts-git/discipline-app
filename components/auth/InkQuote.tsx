"use client";

import { Fragment, useEffect, useState } from "react";
import { COLORS } from "@/lib/constants";

// Public-domain lines that "write themselves" on the sign-in screens.
const QUOTES = [
  { text: "Waste no more time arguing what a good man should be. Be one.", by: "Marcus Aurelius" },
  { text: "We suffer more often in imagination than in reality.", by: "Seneca" },
  { text: "Go to the ant, thou sluggard; consider her ways, and be wise.", by: "Proverbs 6:6" },
  { text: "No man is free who is not master of himself.", by: "Epictetus" },
  { text: "Your business is with action alone; not by any means with fruit.", by: "Bhagavad Gita 2.47" },
  { text: "Well begun is half done.", by: "Aristotle" },
];

const CHAR_MS = 32; // gap between letters appearing
const HOLD_MS = 4200; // how long a finished line stays
const FADE_MS = 700;

// Each letter fades in from a slight blur, like ink settling, then the line
// holds, fades out and the next one begins. With reduced motion, lines simply
// swap every few seconds with no per-letter animation.
export function InkQuote({ size = 26 }: { size?: number }) {
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

  useEffect(() => {
    const q = QUOTES[index];
    const writeMs = still ? 0 : q.text.length * CHAR_MS + 500;
    const t1 = setTimeout(() => setLeaving(true), writeMs + HOLD_MS);
    const t2 = setTimeout(() => {
      setLeaving(false);
      setIndex((i) => (i + 1) % QUOTES.length);
    }, writeMs + HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [index, still]);

  const q = QUOTES[index];
  const authorDelay = still ? 0 : q.text.length * CHAR_MS + 150;

  return (
    <figure
      aria-live="off"
      style={{ margin: 0, opacity: leaving ? 0 : 1, transition: `opacity ${FADE_MS}ms ease`, minHeight: size * 1.35 * 3 + 30 }}
    >
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
                      <span key={c} className="au-ink" style={{ animationDelay: `${(before + c) * CHAR_MS}ms` }}>
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
