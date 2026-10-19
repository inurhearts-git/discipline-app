// Words and phrases that keep a video out of the auto-refill queue. These are
// topics the app does not carry (see the Terms: not advice of any kind) or that
// tend to be misleading. It is a first filter only; an admin still reviews every
// clip, and the same list will guard the life-coach topic later.

export const BLOCKED_TERMS = [
  // divination and similar
  "tarot",
  "astrology",
  "astrologer",
  "horoscope",
  "zodiac",
  "jyotish",
  "jyotisha",
  "numerology",
  "palmistry",
  "palm reading",
  "psychic",
  "clairvoyant",
  "mediumship",
  "spirit medium",
  "occult",
  "witchcraft",
  "casting spells",
  "past life",
  "past-life",
  "fortune teller",
  "fortune telling",
  // misleading promises
  "miracle cure",
  "cure for cancer",
  "get rich",
  "get-rich",
  "passive income",
  "trading signals",
  "crypto signals",
  "forex",
  "pickup artist",
  "dating tactics",
] as const;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PATTERN = new RegExp(`(?<![\\p{L}\\p{N}])(?:${BLOCKED_TERMS.map(escape).join("|")})(?![\\p{L}\\p{N}])`, "iu");

// The blocked term found in the text, or null if it is clean.
export function blockedTerm(text: string): string | null {
  const m = PATTERN.exec(text);
  return m ? m[0].toLowerCase() : null;
}
