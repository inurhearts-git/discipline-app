"use client";

import { useEffect, useState } from "react";
import { COLORS } from "@/lib/constants";

// Usage days roll over at UTC midnight (see todayStr() in lib/constants.ts),
// so this counts down to the next 00:00 UTC, whatever the viewer's time zone.
function msUntilReset(now: number): number {
  const d = new Date(now);
  const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return Math.max(0, next - now);
}

function fmt(ms: number): string {
  const totalMin = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function ResetCountdown() {
  // Starts empty and fills in after mount, so the server and browser render
  // the same HTML and nothing mismatches during hydration.
  const [ms, setMs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setMs(msUntilReset(Date.now()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <p style={{ color: COLORS.slate, fontSize: 12, margin: 0, minHeight: 18 }}>
      {ms === null ? "" : `Your hour resets in ${fmt(ms)}.`}
    </p>
  );
}
