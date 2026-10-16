// A day "counts" toward your streak once you've spent this long in the app.
export const STREAK_MIN_MS = 2 * 60 * 1000;

function prevDay(d: string): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

// Number of consecutive qualifying days ending yesterday.
// Today is added live in the feed once it passes STREAK_MIN_MS.
export function streakThroughYesterday(rows: { date: string; ms_spent: number }[], today: string): number {
  const ok = new Set(rows.filter((r) => r.ms_spent >= STREAK_MIN_MS).map((r) => r.date));
  let n = 0;
  let d = prevDay(today);
  while (ok.has(d)) {
    n++;
    d = prevDay(d);
  }
  return n;
}
