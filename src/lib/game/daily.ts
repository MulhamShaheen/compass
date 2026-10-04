import { addDays, daysBetween, weekdayIndex, weekStart, type DayKey } from "../time";

/** The last 7 days, oldest first, as booleans for the habit strip. */
export function last7(logDays: DayKey[], today: DayKey): boolean[] {
  const set = new Set(logDays);
  return [6, 5, 4, 3, 2, 1, 0].map((n) => set.has(addDays(today, -n)));
}

/**
 * Consecutive logged days ending today. If today is not ticked yet, the streak
 * still counts up to yesterday, so a morning view never reads as broken.
 */
export function habitStreak(logDays: DayKey[], today: DayKey): number {
  const set = new Set(logDays);
  let streak = 0;
  for (let i = 0; i < 3660; i++) {
    if (set.has(addDays(today, -i))) streak++;
    else if (i > 0) break;
  }
  return streak;
}

/** For habits to starve: days in the last 7 without a slip. */
export function cleanDays(logDays: DayKey[], today: DayKey): number {
  return last7(logDays, today).filter((slipped) => !slipped).length;
}

export interface TodayLoop {
  checkin: boolean;
  play: boolean;
  log: boolean;
}

/** The three daily steps, derived from what was logged today. Nothing is stored. */
export function todayLoop(
  s: { weatherDays: DayKey[]; checkpointDays: DayKey[]; journalDays: DayKey[] },
  today: DayKey,
): TodayLoop {
  return {
    checkin: s.weatherDays.includes(today),
    play: s.checkpointDays.includes(today),
    log: s.journalDays.includes(today),
  };
}

export const DEFAULT_PROMPTS = [
  "What moved the story forward today?",
  "Who did you spend time with, and how did it feel?",
  "What drained you, and what fed you?",
  "If today were a chapter title, what would it be?",
  "What would you tell yourself from one year ahead?",
  "Which quest are you avoiding, and why?",
  "What small thing went better than expected?",
] as const;

/** Index of today's prompt. Before prompts rotate, it is always the first one. */
export function promptIndex(startDay: DayKey, today: DayKey, rotates: boolean, count: number = DEFAULT_PROMPTS.length): number {
  if (!rotates) return 0;
  return ((daysBetween(startDay, today) % count) + count) % count;
}

export const REVIEW_PROMPT = "What will next week be about?";

/**
 * The week a review on `today` looks back at: on Monday it is last week,
 * on any other day it is the current week.
 */
export function reviewWeekFor(today: DayKey): DayKey {
  const ws = weekStart(today);
  return weekdayIndex(today) === 0 ? addDays(ws, -7) : ws;
}

/** Suggest the review on Sunday and Monday if that week has none yet. */
export function shouldPromptReview(today: DayKey, reviewedWeeks: DayKey[]): boolean {
  const wd = weekdayIndex(today);
  if (wd !== 6 && wd !== 0) return false;
  return !reviewedWeeks.includes(reviewWeekFor(today));
}
