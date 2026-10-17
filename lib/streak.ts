// A day "counts" toward your streak once you've spent this long in the app.
export const STREAK_MIN_MS = 2 * 60 * 1000;

function prevDay(d: string): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

function nextDay(d: string): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
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

// The longest run of consecutive qualifying days anywhere in the rows.
// Pass every row you have, including today's.
export function bestStreak(rows: { date: string; ms_spent: number }[]): number {
  const days = Array.from(new Set(rows.filter((r) => r.ms_spent >= STREAK_MIN_MS).map((r) => r.date))).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev !== null && nextDay(prev) === d ? run + 1 : 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}

// Streak lengths worth celebrating.
export const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 365] as const;

// The milestone this exact streak length hits, or null.
export function milestoneAt(n: number): number | null {
  return (STREAK_MILESTONES as readonly number[]).includes(n) ? n : null;
}

// The next milestone strictly above n, or null once they're past the last one.
export function nextMilestone(n: number): number | null {
  return STREAK_MILESTONES.find((m) => m > n) ?? null;
}

// Short, plain copy for the celebration shown when a milestone is reached.
export function milestoneCopy(n: number): { title: string; line: string } {
  switch (n) {
    case 3:
      return { title: "Three days in a row.", line: "A habit is starting to form." };
    case 7:
      return { title: "A full week.", line: "Seven days of showing up." };
    case 14:
      return { title: "Two weeks straight.", line: "This is becoming part of your day." };
    case 30:
      return { title: "Thirty days.", line: "That's a habit now." };
    case 60:
      return { title: "Sixty days.", line: "Two months of choosing focus." };
    case 100:
      return { title: "One hundred days.", line: "Few people get this far." };
    case 365:
      return { title: "A full year.", line: "Every single day. Remarkable." };
    default:
      return { title: `${n} days in a row.`, line: "Keep going." };
  }
}
