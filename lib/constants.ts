import type { ContentTag } from "./database.types";

// The ink/parchment/brass palette is the visual identity of the app; keep
// this file as the single source of truth for it.
//
// Each entry points at a CSS variable defined in app/globals.css, so the
// same inline styles work in dark and light mode. Naming note: "ink" is
// the app's background colour and "parchment" its main text colour, in
// BOTH themes (in light mode ink is the cream one and parchment the dark).
//
// Because these are now "var(--x)" strings, never:
//   - save a COLORS value to the database (use a literal hex instead)
//   - append hex alpha like `${COLORS.brass}26` (use alpha() below)
export const COLORS = {
  ink: "var(--ink)",
  ink2: "var(--ink2)",
  ink3: "var(--ink3)",
  parchment: "var(--parchment)",
  brass: "var(--brass)",
  brassDim: "var(--brassDim)",
  ember: "var(--ember)",
  sage: "var(--sage)",
  slate: "var(--slate)",
  line: "var(--line)",
  danger: "var(--danger)",
  // Text that sits ON a brass, ember or danger fill (dark text in the dark
  // theme, light text in the light theme, so both pass contrast).
  onBrass: "var(--onBrass)",
  onEmber: "var(--onEmber)",
  onDanger: "var(--onDanger)",
} as const;

// Transparent version of any colour (hex or var()). pct is 0-100.
export const alpha = (color: string, pct: number) =>
  `color-mix(in srgb, ${color} ${pct}%, transparent)`;

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

// Today's date in UTC. Personal days (usage, streaks, reflections) use the
// person's own zone instead: see lib/day.ts and userToday() in lib/day-server.ts.
export const todayStr = () => new Date().toISOString().slice(0, 10);
