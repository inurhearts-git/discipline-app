// Mood moments: a short guided exercise offered after picking a mood.
// Stressed is 10 slow breaths (6 s in, 6 s out, 2 minutes); the others are
// about 30 seconds. Plain, well-known techniques; nothing clinical.

import type { MoodId } from "@/lib/moods";

export interface MomentStep {
  text: string; // big line
  seconds: number;
  phase?: "in" | "out"; // breathing steps grow and shrink the circle
}

export interface MoodMoment {
  mood: MoodId;
  name: string; // chip and title
  invite: string; // one line on the offer card
  steps: MomentStep[];
  done: string;
}

const breaths: MomentStep[] = [];
for (let i = 0; i < 10; i++) breaths.push({ text: "Breathe in", seconds: 6, phase: "in" }, { text: "Breathe out", seconds: 6, phase: "out" });

export const MOMENTS: Record<MoodId, MoodMoment> = {
  stressed: {
    mood: "stressed",
    name: "Breathe",
    invite: "10 slow breaths with the circle: 6 seconds in, 6 seconds out. About 2 minutes.",
    steps: breaths,
    done: "Ten breaths. Your shoulders are probably a little lower now.",
  },
  unmotivated: {
    mood: "unmotivated",
    name: "Wake up",
    invite: "30 seconds to get your body on your side.",
    steps: [
      { text: "Sit up tall and put both feet flat on the floor.", seconds: 8 },
      { text: "Roll your shoulders back. Slowly, three times.", seconds: 8 },
      { text: "One big breath in… and let it all go.", seconds: 8 },
      { text: "Now just two minutes. Anyone can do two minutes.", seconds: 6 },
    ],
    done: "You're up. Let's go.",
  },
  overthinking: {
    mood: "overthinking",
    name: "Ground",
    invite: "30 seconds to get out of your head: 5, 4, 3, 2, 1.",
    steps: [
      { text: "Find 5 things you can see.", seconds: 6 },
      { text: "4 things you can touch.", seconds: 6 },
      { text: "3 things you can hear.", seconds: 6 },
      { text: "2 things you can smell.", seconds: 6 },
      { text: "1 thing you can taste.", seconds: 6 },
    ],
    done: "You're here, right now. That's enough for this moment.",
  },
  grateful: {
    mood: "grateful",
    name: "Three good things",
    invite: "30 seconds to hold on to the good.",
    steps: [
      { text: "Think of someone who helped you lately.", seconds: 10 },
      { text: "Think of one small thing that went right today.", seconds: 10 },
      { text: "Think of one thing you like about yourself.", seconds: 10 },
    ],
    done: "Keep that feeling. The feed is yours.",
  },
  driven: {
    mood: "driven",
    name: "Lock in",
    invite: "30 seconds to aim all that energy.",
    steps: [
      { text: "Name the one thing that matters most today.", seconds: 10 },
      { text: "Picture it finished. How does that feel?", seconds: 10 },
      { text: "What's the very first step? Start it after this.", seconds: 10 },
    ],
    done: "Locked in. Go get it.",
  },
};

export function momentSeconds(m: MoodMoment): number {
  return m.steps.reduce((t, s) => t + s.seconds, 0);
}
