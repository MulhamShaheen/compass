import type { Feature } from "../game/unlocks";
import type { Attribute, HabitKind, QuestStatus, QuestType, Weather } from "../game/types";
import type { DayKey } from "../time";

/**
 * Record shapes mirror the tables in docs/IMPLEMENTATION_PLAN.md §2 (camelCased).
 * There is no user_id: the local prototype store holds a single character.
 */

export interface Profile {
  characterName: string | null;
  trueNorth: string | null;
  timezone: string;
  quietMode: boolean;
  prologueCompletedAt: string | null;
  createdAt: string;
}

export interface Chapter {
  id: string;
  title: string;
  startedOn: DayKey;
  endedOn: DayKey | null;
}

export interface AttributeRating {
  id: string;
  attribute: Attribute;
  rating: number;
  context: "baseline" | "weekly_review";
  ratedAt: string;
}

export interface Quest {
  id: string;
  chapterId: string | null;
  type: QuestType;
  status: QuestStatus;
  title: string;
  why: string | null;
  primaryAttr: Attribute;
  secondaryAttr: Attribute | null;
  startedOn: DayKey;
  completedAt: string | null;
  createdAt: string;
}

export interface Checkpoint {
  id: string;
  questId: string;
  occurredAt: string;
  title: string;
  note: string | null;
  minutes: number;
  isMilestone: boolean;
  source: "manual" | "calendar" | "system";
  createdAt: string;
}

export interface Habit {
  id: string;
  name: string;
  kind: HabitKind;
  archivedAt: string | null;
  createdAt: string;
}

export interface HabitLog {
  habitId: string;
  day: DayKey;
}

export interface WeatherLog {
  day: DayKey;
  weather: Weather;
}

export interface JournalEntry {
  id: string;
  day: DayKey;
  prompt: string | null;
  body: string;
  weather: Weather | null;
  createdAt: string;
}

export interface Unlock {
  feature: Feature;
  unlockedAt: string;
  /** When the one-time unlock card was dismissed. */
  seenAt: string | null;
}

export interface WeeklyReview {
  id: string;
  weekStart: DayKey;
  note: string | null;
  completedAt: string;
}

export interface Db {
  version: 1;
  profile: Profile | null;
  chapters: Chapter[];
  ratings: AttributeRating[];
  quests: Quest[];
  checkpoints: Checkpoint[];
  habits: Habit[];
  habitLogs: HabitLog[];
  weather: WeatherLog[];
  journal: JournalEntry[];
  unlocks: Unlock[];
  reviews: WeeklyReview[];
  /** Prototype only: shifts the app clock by whole days to simulate the first week. */
  dev: { dayOffset: number };
  /** Active logbook prompts, read-only (the prompts table). Falls back to the defaults. */
  prompts?: string[];
}

export function emptyDb(): Db {
  return {
    version: 1,
    profile: null,
    chapters: [],
    ratings: [],
    quests: [],
    checkpoints: [],
    habits: [],
    habitLogs: [],
    weather: [],
    journal: [],
    unlocks: [],
    reviews: [],
    dev: { dayOffset: 0 },
  };
}
