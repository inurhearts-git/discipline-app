// Today's mood on this device, for the mood looks (colours and motion) and
// the mood moments. Browser only; everything is in localStorage, so nothing
// about someone's mood is sent to the server by this.

import { localDay } from "@/lib/day";
import { isMoodId, type MoodId } from "@/lib/moods";

const MOOD_KEY = "mf-mood"; // {"day":"2026-10-24","id":"stressed"}
const LOOK_KEY = "mf-mood-look"; // "off" turns colours and motion off on this device
export const MOOD_CHANGED = "mood-changed";

export function todayMood(): MoodId | null {
  try {
    const raw = localStorage.getItem(MOOD_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { day?: string; id?: string };
    return v.day === localDay() && typeof v.id === "string" && isMoodId(v.id) ? v.id : null;
  } catch {
    return null;
  }
}

export function setTodayMood(id: MoodId | null): void {
  try {
    localStorage.setItem(MOOD_KEY, JSON.stringify({ day: localDay(), id }));
    // The feed page reads this, so opening the Feed tab keeps today's mood.
    document.cookie = `mf_mood=${encodeURIComponent(`${localDay()}:${id ?? ""}`)}; path=/; max-age=${60 * 60 * 26}; samesite=lax`;
  } catch {
    // storage blocked: the look simply stays plain
  }
  window.dispatchEvent(new Event(MOOD_CHANGED));
}

export function moodLookOn(): boolean {
  try {
    return localStorage.getItem(LOOK_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setMoodLookOn(on: boolean): void {
  try {
    if (on) localStorage.removeItem(LOOK_KEY);
    else localStorage.setItem(LOOK_KEY, "off");
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(MOOD_CHANGED));
}
