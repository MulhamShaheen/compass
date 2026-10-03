import { addDays, dayKey, daysBetween, weekStart, type DayKey } from "../time";
import { attributeTotals, checkpointPoints, splitByAttributes, type AttributeTotals } from "./points";
import { ATTRIBUTES, ATTRIBUTE_NAMES, type Attribute, type GameCheckpoint, type GameQuest } from "./types";

export interface WeekHours {
  weekStart: DayKey;
  hours: Record<Attribute, number>;
  total: number;
}

/** Hours per attribute per week (Monday start) for the last `weeks` weeks, oldest first. */
export function weeklyHours(
  quests: GameQuest[],
  checkpoints: GameCheckpoint[],
  opts: { now: Date; tz: string; weeks?: number },
): WeekHours[] {
  const n = opts.weeks ?? 12;
  const current = weekStart(dayKey(opts.now, opts.tz));
  const result: WeekHours[] = Array.from({ length: n }, (_, i) => ({
    weekStart: addDays(current, -(n - 1 - i) * 7),
    hours: Object.fromEntries(ATTRIBUTES.map((a) => [a, 0])) as Record<Attribute, number>,
    total: 0,
  }));
  const index = new Map(result.map((w, i) => [w.weekStart, i]));
  const byId = new Map(quests.map((q) => [q.id, q]));
  for (const cp of checkpoints) {
    const quest = byId.get(cp.questId);
    if (!quest || quest.type === "system") continue;
    const i = index.get(weekStart(dayKey(new Date(cp.occurredAt), opts.tz)));
    if (i === undefined) continue;
    for (const [attr, m] of splitByAttributes(quest, cp.minutes)) {
      result[i].hours[attr] += m / 60;
      result[i].total += m / 60;
    }
  }
  return result;
}

export interface ShareRow {
  attr: Attribute;
  minutes: number;
  /** 0 to 1 of all logged minutes. */
  share: number;
  /** 0 to 1 relative to the largest attribute (for bar width). */
  relative: number;
}

/** Attributes sorted by minutes logged, most first. */
export function shareRows(totals: AttributeTotals): ShareRow[] {
  const all = ATTRIBUTES.reduce((s, a) => s + totals[a].minutes, 0);
  const max = Math.max(1, ...ATTRIBUTES.map((a) => totals[a].minutes));
  return ATTRIBUTES.map((attr) => ({
    attr,
    minutes: totals[attr].minutes,
    share: all > 0 ? totals[attr].minutes / all : 0,
    relative: totals[attr].minutes / max,
  })).sort((a, b) => b.minutes - a.minutes);
}

/** One line about where the time went. `rangeDays` null means all time. */
export function insight(totals: AttributeTotals, rangeDays: number | null): string {
  const rows = shareRows(totals);
  const all = rows.reduce((s, r) => s + r.minutes, 0);
  if (all <= 0) return "Log checkpoints with time spent to see where your time goes.";
  const top = rows[0];
  const low = rows[rows.length - 1];
  const when = rangeDays ? ` in the last ${rangeDays} days` : "";
  return `${ATTRIBUTE_NAMES[top.attr]} took the most of your time${when}. ${ATTRIBUTE_NAMES[low.attr]} got the least${low.minutes ? "" : " (nothing logged)"}.`;
}

/** Totals for each of the dashboard ranges. */
export function rangeTotals(quests: GameQuest[], checkpoints: GameCheckpoint[], now: Date) {
  const since = (days: number) => new Date(now.getTime() - days * 86_400_000);
  return {
    30: attributeTotals(quests, checkpoints, { since: since(30) }),
    90: attributeTotals(quests, checkpoints, { since: since(90) }),
    all: attributeTotals(quests, checkpoints),
  };
}

/**
 * Checkpoints per week for one quest, oldest first. A milestone counts double,
 * so the strip shows both rhythm and big moments.
 */
export function questPulse(checkpoints: GameCheckpoint[], opts: { now: Date; tz: string; weeks?: number }): number[] {
  const n = opts.weeks ?? 16;
  const current = weekStart(dayKey(opts.now, opts.tz));
  const counts = Array<number>(n).fill(0);
  for (const cp of checkpoints) {
    const w = Math.round(daysBetween(weekStart(dayKey(new Date(cp.occurredAt), opts.tz)), current) / 7);
    if (w >= 0 && w < n) counts[n - 1 - w] += cp.isMilestone ? 2 : 1;
  }
  return counts;
}

export interface QuestStats {
  startedOn: DayKey;
  daysRunning: number;
  checkpoints: number;
  minutes: number;
  points: number;
}

export function questStats(
  quest: { startedOn: DayKey },
  checkpoints: GameCheckpoint[],
  today: DayKey,
): QuestStats {
  return {
    startedOn: quest.startedOn,
    daysRunning: daysBetween(quest.startedOn, today) + 1,
    checkpoints: checkpoints.length,
    minutes: checkpoints.reduce((s, c) => s + c.minutes, 0),
    points: Math.round(checkpoints.reduce((s, c) => s + checkpointPoints(c), 0)),
  };
}

/** Label for the gap between a checkpoint and the one before it. */
export function gapLabel(prevDay: DayKey, day: DayKey): string {
  const d = daysBetween(prevDay, day);
  return d > 0 ? `${d}-day gap` : "same day";
}
