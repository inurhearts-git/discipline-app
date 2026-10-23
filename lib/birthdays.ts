// Birthdays (migration 0019): your own (from your date of birth) and those of
// people close to you, stored without names.
//
// To add a category, add one line to RELATIONS (and, if it needs its own kind
// of quote, a list to QUOTES). Nothing else changes: the database accepts any
// short lowercase id, and the API only accepts ids listed here.
//
// Every quote here is written for Discipline (none are copied from anywhere),
// so they can be shared freely.

export type Pronoun = "her" | "him" | "them";
export type QuoteGroup = "partner" | "child" | "parent" | "grandparent" | "sibling" | "friend" | "work";

export interface Relation {
  id: string;
  label: string; // "spouse" -> "your spouse"
  group: QuoteGroup;
  pronoun?: Pronoun; // fixed for daughter, son, mother...; asked for otherwise
}

export const RELATIONS: Relation[] = [
  { id: "spouse", label: "spouse", group: "partner" },
  { id: "partner", label: "partner", group: "partner" },
  { id: "daughter", label: "daughter", group: "child", pronoun: "her" },
  { id: "son", label: "son", group: "child", pronoun: "him" },
  { id: "child", label: "child", group: "child" },
  { id: "mother", label: "mother", group: "parent", pronoun: "her" },
  { id: "father", label: "father", group: "parent", pronoun: "him" },
  { id: "grandmother", label: "grandmother", group: "grandparent", pronoun: "her" },
  { id: "grandfather", label: "grandfather", group: "grandparent", pronoun: "him" },
  { id: "sister", label: "sister", group: "sibling", pronoun: "her" },
  { id: "brother", label: "brother", group: "sibling", pronoun: "him" },
  { id: "best_friend", label: "best friend", group: "friend" },
  { id: "friend", label: "friend", group: "friend" },
  { id: "colleague", label: "colleague", group: "work" },
  { id: "mentor", label: "mentor", group: "work" },
];

export function relationById(id: string): Relation | undefined {
  return RELATIONS.find((r) => r.id === id);
}

export const MAX_BIRTHDAYS = 50;

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function daysInMonth(month: number): number {
  return month === 2 ? 29 : [4, 6, 9, 11].includes(month) ? 30 : 31;
}

// "14 March"
export function fmtBirthday(month: number, day: number): string {
  return `${day} ${MONTHS[month - 1]}`;
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

// Is a birthday on this calendar date ("2026-10-24")? 29 February birthdays
// are celebrated on 28 February in years without a 29th.
export function isBirthdayOn(month: number, day: number, date: string): boolean {
  const [y, m, d] = date.split("-").map(Number);
  if (month === 2 && day === 29 && !isLeap(y)) return m === 2 && d === 28;
  return m === month && d === day;
}

const QUOTES: Record<QuoteGroup | "self", string[]> = {
  self: [
    "Another year of showing up. The best chapters are still being written.",
    "You don't get older on your birthday. You get one more year of proof that you can do hard things.",
    "Celebrate how far you've come, then look at how far you're still able to go.",
    "A year ago you were hoping for some of the things you have now. Notice them today.",
    "Today the world is one year luckier to have you in it.",
  ],
  partner: [
    "Of all the days I'm grateful for, the one you were born is first.",
    "Every ordinary day is better because you're in it. Today is no ordinary day.",
    "Here's to the person who makes home feel like home. Happy birthday.",
    "Growing older is easy. Growing together is the good part.",
  ],
  child: [
    "You were the best surprise life ever gave me. Happy birthday.",
    "Every year you grow a little taller, and my heart grows a lot bigger.",
    "Keep your curiosity, keep your kindness, and keep being exactly you.",
    "The world got brighter the day you arrived, and it still does every morning.",
  ],
  parent: [
    "Everything good in me started with you. Happy birthday.",
    "You gave me roots to stand on and room to grow. Thank you, today and always.",
    "The older I get, the more I understand how much you gave.",
    "Some people are lucky to have a hero. I get to call mine family.",
  ],
  grandparent: [
    "Your stories are some of my favourite things. Here's to many more of them.",
    "Every year with you is a gift the whole family shares.",
    "You've seen a lot of birthdays. This one comes with a lot of love.",
    "Thank you for every lesson, every laugh, and every second helping. Happy birthday.",
  ],
  sibling: [
    "Partner in crime, keeper of secrets, friend for life. Happy birthday.",
    "We grew up side by side, and I'm glad we're still growing up together.",
    "No one else remembers what I remember. Here's to another year of it.",
    "You were my first friend. You're still one of the best.",
  ],
  friend: [
    "Good friends make the good days better and the hard days shorter. Happy birthday.",
    "Here's to the laughs we've had and the ones still on their way.",
    "The world needs more people like you. I'm glad I got one of the originals.",
    "Another year older, and still my favourite person to call.",
  ],
  work: [
    "Wishing you a year of good work, good people and well-earned rest.",
    "Thank you for making the hard days easier. Happy birthday.",
    "Here's to another year of doing great things and making it look easy.",
    "People like you make showing up worth it. Have a wonderful day.",
  ],
};

// A steady pick: the same quote all day, a different one next year.
function pick(list: string[], seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

export function ownBirthdayQuote(userId: string, year: number): string {
  return pick(QUOTES.self, `${userId}:${year}`);
}

export function birthdayQuote(relationId: string, birthdayId: string, year: number): string {
  const group = relationById(relationId)?.group ?? "friend";
  return pick(QUOTES[group], `${birthdayId}:${year}`);
}

export function pronounOf(b: { relation: string; pronoun: string }): Pronoun {
  return relationById(b.relation)?.pronoun ?? (b.pronoun === "her" || b.pronoun === "him" ? b.pronoun : "them");
}

// The reminder and the card text.
export function birthdayMessage(b: { relation: string; pronoun: string }): { title: string; body: string } {
  const who = relationById(b.relation)?.label ?? "friend";
  const p = pronounOf(b);
  const obj = p;
  const poss = p === "her" ? "her" : p === "him" ? "his" : "their";
  return {
    title: `It's your ${who}'s birthday today 🎂`,
    body: `Send ${obj} a birthday wish along with this quote to make ${poss} day.`,
  };
}
