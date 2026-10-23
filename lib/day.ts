// What "today" means. Usage (the daily hour), streaks and reflections follow
// each person's own calendar day, midnight to midnight in their time zone.
// The browser reports its zone in the "mf_tz" cookie (components/ui/ZoneSync);
// without it, days fall back to UTC. Safe to use on the server and in the browser.

export const TZ_COOKIE = "mf_tz";

// A real IANA zone name ("Asia/Dubai"), or "UTC".
export function safeZone(tz: string | null | undefined): string {
  if (!tz || tz.length > 64) return "UTC";
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

// "2026-10-23": the calendar date in that zone at that moment.
export function dayIn(tz: string, at: Date = new Date()): string {
  return at.toLocaleDateString("en-CA", { timeZone: safeZone(tz), year: "numeric", month: "2-digit", day: "2-digit" });
}

// The browser's own calendar date (client only).
export function localDay(at: Date = new Date()): string {
  return dayIn(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", at);
}

export function addDays(day: string, n: number): string {
  const t = new Date(`${day}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

// The zone's offset from UTC at that moment, in minutes (Dubai: 240).
export function zoneOffsetMinutes(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: safeZone(tz),
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
}

// The moment a calendar day starts in that zone (handles daylight saving).
export function startOfDay(day: string, tz: string): Date {
  const guess = Date.parse(`${day}T00:00:00Z`);
  let t = guess - zoneOffsetMinutes(tz, new Date(guess)) * 60000;
  const again = guess - zoneOffsetMinutes(tz, new Date(t)) * 60000;
  if (again !== t) t = again;
  return new Date(t);
}

// When the current day ends (the next midnight) in that zone.
export function nextMidnight(tz: string, at: Date = new Date()): Date {
  return startOfDay(addDays(dayIn(tz, at), 1), tz);
}

// The hour (0-23) on the clock in that zone.
export function hourIn(tz: string, at: Date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-GB", { timeZone: safeZone(tz), hour: "numeric", hourCycle: "h23" }).format(at);
  return Number(h) % 24;
}
