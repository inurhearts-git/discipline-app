"use client";

import { useEffect, useState } from "react";
import { COLORS, alpha } from "@/lib/constants";
import { moodLookOn, setMoodLookOn } from "@/lib/mood-look";

// Profile > Appearance: colours and gentle motion that follow today's mood.
// Saved on this device only.
export function MoodLookToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => setOn(moodLookOn()), []);
  const toggle = () => {
    setMoodLookOn(!on);
    setOn(!on);
  };
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.line}`, cursor: "pointer" }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, color: COLORS.parchment }}>Mood colours</span>
        <span style={{ display: "block", fontSize: 11, color: COLORS.slate, lineHeight: 1.45, marginTop: 2 }}>
          The feed takes on the colour of the mood you pick, with gentle motion. Motion stays off if your device is set to reduce it.
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Mood colours"
        onClick={toggle}
        style={{ width: 40, height: 24, borderRadius: 12, border: `1px solid ${on ? COLORS.brass : COLORS.line}`, background: on ? COLORS.brass : alpha(COLORS.slate, 18), position: "relative", cursor: "pointer", flexShrink: 0, padding: 0 }}
      >
        <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: "50%", background: on ? COLORS.onBrass : COLORS.parchment, transition: "left 0.15s" }} />
      </button>
    </label>
  );
}
