"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MOOD_CHANGED, moodLookOn, todayMood } from "@/lib/mood-look";
import type { MoodId } from "@/lib/moods";

// Pages that take on today's mood. Admin and settings pages stay plain.
const MOOD_PAGES = ["/feed", "/today", "/explore", "/people"];

// Today's mood for this page, or null (no mood, switched off, or another page).
// Also sets data-mood on <html>, which switches the colours (app/globals.css).
export function useMoodLook(): MoodId | null {
  const pathname = usePathname() ?? "";
  const [mood, setMood] = useState<MoodId | null>(null);
  useEffect(() => {
    const update = () => {
      const m = MOOD_PAGES.some((p) => pathname.startsWith(p)) && moodLookOn() ? todayMood() : null;
      setMood(m);
      if (m) document.documentElement.setAttribute("data-mood", m);
      else document.documentElement.removeAttribute("data-mood");
    };
    update();
    window.addEventListener(MOOD_CHANGED, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(MOOD_CHANGED, update);
      window.removeEventListener("storage", update);
    };
  }, [pathname]);
  return mood;
}

const SPECKS = [
  { left: "12%", delay: "0s", dur: "21s" },
  { left: "34%", delay: "7s", dur: "25s" },
  { left: "58%", delay: "3s", dur: "23s" },
  { left: "79%", delay: "11s", dur: "27s" },
  { left: "91%", delay: "16s", dur: "22s" },
];

// The gentle motion for the mood: edges and corners only, never covering text.
export function MoodLayer({ mood }: { mood: MoodId | null }) {
  if (!mood) return null;
  return (
    <div className={`mood-layer mood-${mood}`} aria-hidden="true">
      <i className="glow" />
      {mood === "grateful" && SPECKS.map((s, i) => <i key={i} className="speck" style={{ left: s.left, animationDelay: s.delay, animationDuration: s.dur }} />)}
      {mood === "driven" && (
        <>
          <i className="run top" />
          <i className="run bottom" />
        </>
      )}
    </div>
  );
}
