// Quote of the day: one quote or scripture, the same for everyone, new each UTC day.

// Small, stable string hash (FNV-1a).
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Each item gets a score from the date and its own id; the lowest score wins.
// Unlike "pick index N", adding or removing other items rarely changes the
// answer, so the quote doesn't flip partway through the day.
export function pickQuoteOfTheDay(ids: string[], date: string): string | null {
  let best: string | null = null;
  let bestScore = Infinity;
  for (const id of ids) {
    const score = hash(`${date}:${id}`);
    if (score < bestScore || (score === bestScore && best !== null && id < best)) {
      best = id;
      bestScore = score;
    }
  }
  return best;
}
