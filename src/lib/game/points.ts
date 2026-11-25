import { ATTRIBUTES, type Attribute, type GameCheckpoint, type GameQuest } from "./types";
import type { CompassEvent } from "../db/schema";

export const POINTS_PER_MINUTE_DIVISOR = 6;
export const NOTE_ONLY_POINTS = 2;
export const MILESTONE_BONUS = 25;
export const PRIMARY_SHARE = 0.7;
export const ATTRIBUTE_LEVEL_STEP = 150;
export const CHARACTER_LEVEL_STEP = 400;

/** 1 point per 6 minutes, 2 points for a note with no time, +25 for a milestone. */
export function checkpointPoints(cp: Pick<GameCheckpoint, "minutes" | "isMilestone">): number {
  const base = cp.minutes > 0 ? Math.round(cp.minutes / POINTS_PER_MINUTE_DIVISOR) : NOTE_ONLY_POINTS;
  return base + (cp.isMilestone ? MILESTONE_BONUS : 0);
}

export function eventPoints(event: Pick<CompassEvent, "completedAt" | "checkpointId" | "startsAt" | "endsAt">): number {
  if (!event.completedAt || event.checkpointId) return 0;
  const minutes = (Date.parse(event.endsAt) - Date.parse(event.startsAt)) / 60_000;
  return checkpointPoints({ minutes, isMilestone: false });
}

/** 100% to the primary attribute, or 70/30 when the quest has a secondary one. */
export function splitByAttributes(
  quest: Pick<GameQuest, "primaryAttr" | "secondaryAttr">,
  value: number,
): [Attribute, number][] {
  if (quest.secondaryAttr && quest.secondaryAttr !== quest.primaryAttr) {
    return [
      [quest.primaryAttr, value * PRIMARY_SHARE],
      [quest.secondaryAttr, value * (1 - PRIMARY_SHARE)],
    ];
  }
  return [[quest.primaryAttr, value]];
}

export type AttributeTotals = Record<Attribute, { points: number; minutes: number }>;

export function emptyTotals(): AttributeTotals {
  return Object.fromEntries(ATTRIBUTES.map((a) => [a, { points: 0, minutes: 0 }])) as AttributeTotals;
}

/**
 * Points per attribute from checkpoints and completed events. Logged minutes come from checkpoints.
 * System quests (the Prologue) never feed attributes.
 */
export function attributeTotals(
  quests: GameQuest[],
  checkpoints: GameCheckpoint[],
  opts: { since?: Date; events?: CompassEvent[] } = {},
): AttributeTotals {
  const byId = new Map(quests.map((q) => [q.id, q]));
  const totals = emptyTotals();
  for (const cp of checkpoints) {
    const quest = byId.get(cp.questId);
    if (!quest || quest.type === "system") continue;
    if (opts.since && new Date(cp.occurredAt) < opts.since) continue;
    for (const [attr, v] of splitByAttributes(quest, checkpointPoints(cp))) totals[attr].points += v;
    for (const [attr, v] of splitByAttributes(quest, cp.minutes)) totals[attr].minutes += v;
  }
  for (const event of opts.events ?? []) {
    if (opts.since && new Date(event.startsAt) < opts.since) continue;
    const points = eventPoints(event);
    if (!points) continue;
    const quest = event.questId ? byId.get(event.questId) : undefined;
    if (quest?.type === "system") continue;
    const shares = quest ? splitByAttributes(quest, points) : [[event.attribute, points]] as const;
    for (const [attribute, share] of shares) totals[attribute].points += share;
  }
  return totals;
}

export function totalPoints(totals: AttributeTotals): number {
  return Math.round(ATTRIBUTES.reduce((sum, a) => sum + totals[a].points, 0));
}

export interface LevelInfo {
  level: number;
  /** Points earned into the current level. */
  into: number;
  /** Points per level. */
  step: number;
  /** 0 to 1. */
  progress: number;
}

function levelFor(points: number, step: number): LevelInfo {
  const p = Math.max(0, Math.round(points));
  const into = p % step;
  return { level: Math.floor(p / step) + 1, into, step, progress: into / step };
}

export function attributeLevel(points: number): LevelInfo {
  return levelFor(points, ATTRIBUTE_LEVEL_STEP);
}

export function characterLevel(total: number): LevelInfo {
  return levelFor(total, CHARACTER_LEVEL_STEP);
}
