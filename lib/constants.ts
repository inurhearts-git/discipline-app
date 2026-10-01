import type { ContentTag } from "./database.types";

// Ported 1:1 from motivation-feed.jsx — the ink/parchment/brass palette
// is the visual identity of the app; keep this file as the single source
// of truth for it.
export const COLORS = {
  ink: "#14110F",
  ink2: "#1C1814",
  ink3: "#231E18",
  parchment: "#F6F1E7",
  brass: "#C9A227",
  brassDim: "#8A701D",
  ember: "#C2542E",
  sage: "#8CA07A",
  slate: "#9C968A",
  line: "rgba(246,241,231,0.14)",
  danger: "#C24E4E",
} as const;

export const CATEGORIES: { key: ContentTag; label: string; desc: string }[] = [
  { key: "QUOTE", label: "Quotes", desc: "Sharp lines from thinkers and doers" },
  { key: "SCRIPTURE", label: "Scripture", desc: "Verses across traditions" },
  { key: "SPEECH", label: "Speeches", desc: "Moments worth replaying" },
];

export const DAILY_LIMIT_MS = 60 * 60 * 1000;

// Heartbeat cadence + the max delta the server will accept per call. This
// is the server-side clamp described in blueprint §5 — it stops a client
// from sending an inflated deltaMs to bypass the cap early.
export const HEARTBEAT_INTERVAL_MS = 15_000;
export const MAX_HEARTBEAT_DELTA_MS = 20_000;

export const tagColor = (tag: ContentTag) =>
  tag === "SCRIPTURE" ? COLORS.sage : tag === "SPEECH" ? COLORS.ember : COLORS.brass;

export const fmtClock = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

// Blueprint §8: display view counts the same way social apps do —
// 1234 -> "1.2k", 1,200,000 -> "1.2M".
export const fmtCount = (n: number) => {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n % 1000 < 100 ? 0 : 1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
};

// Blueprint §6: age gating. No birthdate on file is treated as "not
// confirmed adult" — the conservative default — rather than assuming
// adulthood. This keeps mature content hidden until someone actually
// provides a birthdate that implies 18+, matching the blueprint's note to
// "keep this simple at launch" with a binary general/mature flag.
export const isAdult = (birthdate: string | null): boolean => {
  if (!birthdate) return false;
  const dob = new Date(`${birthdate}T00:00:00`);
  if (Number.isNaN(dob.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 18;
};

export const todayStr = () => new Date().toISOString().slice(0, 10);
