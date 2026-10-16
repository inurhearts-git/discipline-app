export const MOODS = [
  { id: "stressed", label: "Stressed", emoji: "😤" },
  { id: "unmotivated", label: "Can't be bothered", emoji: "😴" },
  { id: "overthinking", label: "Overthinking", emoji: "🌀" },
  { id: "grateful", label: "Grateful", emoji: "🙏" },
  { id: "driven", label: "Locked in", emoji: "🎯" },
] as const;

export type MoodId = (typeof MOODS)[number]["id"];

export function isMoodId(v: string): v is MoodId {
  return MOODS.some((m) => m.id === v);
}
