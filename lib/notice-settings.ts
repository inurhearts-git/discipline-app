// The notice switches on Profile (shared by the browser and the server).

// The switches on Profile. Admin notices have no switch.
export const NOTICE_SETTINGS = [
  { id: "streak", label: "Streak", hint: "Milestones, and a reminder about 3 hours before your streak would end" },
  { id: "collections", label: "New collections", hint: "When a new collection appears on Explore" },
  { id: "submissions", label: "Your submissions", hint: "When something you submitted is approved or not approved" },
  { id: "comeback", label: "When you've been away", hint: "A gentle nudge after 2 days without opening the app, and once more after 10" },
  { id: "birthdays", label: "Birthdays", hint: "At 9 AM on the birthdays you added below, with a quote to send" },
] as const;
export type NoticeSettingId = (typeof NOTICE_SETTINGS)[number]["id"];
export type NoticeSettings = Record<NoticeSettingId, boolean>;
export const DEFAULT_SETTINGS: NoticeSettings = { streak: true, collections: true, submissions: true, comeback: true, birthdays: true };
