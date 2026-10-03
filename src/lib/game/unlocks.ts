import { daysBetween, type DayKey } from "../time";

export const FEATURES = [
  "prompts_rotate",
  "habits",
  "side_quests",
  "character",
  "where_life_goes",
  "weekly_review",
  "calendar",
] as const;
export type Feature = (typeof FEATURES)[number];

export interface UnlockState {
  /** The day the Prologue was completed (day 1). */
  startDay: DayKey;
  today: DayKey;
  /** Distinct days with an inner weather check-in. */
  checkinDays: number;
  /** Checkpoints on main and side quests. */
  checkpoints: number;
  /** Main and side quests with at least one checkpoint. */
  questsWithCheckpoints: number;
  totalPoints: number;
  journalEntries: number;
  weeklyReviews: number;
}

/** Day 1 is the day of the Prologue. */
export function dayNumber(startDay: DayKey, today: DayKey): number {
  return Math.max(1, daysBetween(startDay, today) + 1);
}

/** Every feature whose trigger has happened. Triggered by play, with a time fallback. */
export function evaluateUnlocks(s: UnlockState): Feature[] {
  const day = dayNumber(s.startDay, s.today);
  const met: Record<Feature, boolean> = {
    prompts_rotate: s.journalEntries >= 1,
    habits: s.checkinDays >= 2 || day >= 3,
    side_quests: s.checkpoints >= 3 || day >= 4,
    character: s.totalPoints >= 50,
    where_life_goes: (s.checkpoints >= 5 && s.questsWithCheckpoints >= 2) || day >= 7,
    weekly_review: day >= 7,
    calendar: s.weeklyReviews >= 1,
  };
  return FEATURES.filter((f) => met[f]);
}

export const UNLOCK_COPY: Record<Feature, { title: string; body: string }> = {
  prompts_rotate: { title: "Logbook prompts", body: "Another question will wait for you tomorrow." },
  habits: { title: "Habits", body: "Small things, done daily. Pick one to keep and one to starve." },
  side_quests: { title: "Side quests", body: "Not every thread is the main story." },
  character: { title: "Character", body: "Your attributes are waking up." },
  where_life_goes: { title: "Where life goes", body: "Here's where your time went." },
  weekly_review: { title: "Weekly review", body: "Five minutes to look back at the week and choose the next one." },
  calendar: { title: "Calendar", body: "Want Compass to see your busy and free time?" },
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** One quiet line saying when a locked feature opens. */
export function lockedHint(feature: Feature, s: UnlockState): string {
  const day = dayNumber(s.startDay, s.today);
  switch (feature) {
    case "prompts_rotate":
      return "Opens after your first logbook entry.";
    case "habits":
      return `Opens after 2 days with a check-in (${s.checkinDays} so far), or on day 3. Today is day ${day}.`;
    case "side_quests":
      return `Opens after 3 checkpoints (${s.checkpoints} so far), or on day 4. Today is day ${day}.`;
    case "character":
      return `Opens at 50 points (${s.totalPoints} so far).`;
    case "where_life_goes":
      return `Opens after 5 checkpoints across 2 quests (${plural(s.checkpoints, "checkpoint")} on ${plural(s.questsWithCheckpoints, "quest")} so far), or on day 7.`;
    case "weekly_review":
      return `Opens on day 7. Today is day ${day}.`;
    case "calendar":
      return "Opens after your first weekly review.";
  }
}
