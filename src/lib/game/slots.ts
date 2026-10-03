import type { GameQuest, HabitKind } from "./types";

export const SIDE_SLOT_LEVELS = [3, 5, 8] as const;
export const BASE_SIDE_SLOTS = 3;
export const BASE_HABIT_SLOTS = 2;
export const MAX_HABIT_SLOTS = 6;

export function questSlots(characterLevel: number): { main: number; side: number } {
  return { main: 1, side: BASE_SIDE_SLOTS + SIDE_SLOT_LEVELS.filter((l) => characterLevel >= l).length };
}

export function nextSideSlotLevel(characterLevel: number): number | null {
  return SIDE_SLOT_LEVELS.find((l) => characterLevel < l) ?? null;
}

export type SlotCheck = { ok: true } | { ok: false; reason: string };

/** Can a quest of `type` become active, given the quests that are active now? */
export function canActivateQuest(
  type: "main" | "side",
  quests: Pick<GameQuest, "id" | "type" | "status">[],
  characterLevel: number,
  opts: { excludeId?: string } = {},
): SlotCheck {
  const slots = questSlots(characterLevel);
  const used = quests.filter((q) => q.status === "active" && q.type === type && q.id !== opts.excludeId).length;
  if (used < slots[type]) return { ok: true };
  if (type === "main") {
    return { ok: false, reason: "Your main quest slot is taken. Pause or complete it to begin another." };
  }
  const next = nextSideSlotLevel(characterLevel);
  return {
    ok: false,
    reason: `All ${slots.side} side quest slots are in use. Pause one to make room${next ? `, or reach level ${next} for another` : ""}.`,
  };
}

export function habitSlots(reviewsCompleted: number): number {
  return Math.min(BASE_HABIT_SLOTS + reviewsCompleted, MAX_HABIT_SLOTS);
}

/** Until the first weekly review, habits are limited to one to keep and one to starve. */
export function canAddHabit(
  kind: HabitKind,
  activeHabits: { kind: HabitKind }[],
  reviewsCompleted: number,
): SlotCheck {
  const slots = habitSlots(reviewsCompleted);
  if (activeHabits.length >= slots) {
    return { ok: false, reason: `All ${slots} habit slots are in use. Each weekly review adds one.` };
  }
  if (reviewsCompleted === 0 && activeHabits.some((h) => h.kind === kind)) {
    return {
      ok: false,
      reason: `Start with one habit to ${kind}. More slots open with your first weekly review.`,
    };
  }
  return { ok: true };
}
