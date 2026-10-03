import { describe, expect, it } from "vitest";
import {
  ATTRIBUTES,
  attributeLevel,
  attributeTotals,
  characterLevel,
  questStats,
  rangeTotals,
  totalPoints,
  weeklyHours,
} from "@/lib/game";
import { dayKey } from "@/lib/time";
import { SAMPLE_NOW, SAMPLE_TZ, sample } from "../fixtures/sample";

/**
 * Expected values were produced by running the prototype's own functions
 * (docs/prototype/compass.html) against the same sample with the clock fixed
 * at 2026-10-02T12:00Z in UTC.
 */
const db = sample();
const round = (n: number) => Math.round(n * 1000) / 1000;
const pick = (t: ReturnType<typeof attributeTotals>, key: "points" | "minutes") =>
  Object.fromEntries(ATTRIBUTES.map((a) => [a, round(t[a][key])]));

describe("sample character matches the prototype", () => {
  const ranges = rangeTotals(db.quests, db.checkpoints, SAMPLE_NOW);

  it("all-time points and minutes", () => {
    expect(pick(ranges.all, "points")).toEqual({ body: 112, mind: 215.5, bonds: 186.4, craft: 161, spirit: 50.1 });
    expect(pick(ranges.all, "minutes")).toEqual({ body: 451.5, mind: 948, bonds: 912, craft: 756, spirit: 202.5 });
  });

  it("90-day and 30-day ranges", () => {
    expect(pick(ranges[90], "points")).toEqual({ body: 112, mind: 150.5, bonds: 132.9, craft: 59.5, spirit: 50.1 });
    expect(pick(ranges[90], "minutes")).toEqual({ body: 451.5, mind: 708, bonds: 636, craft: 252, spirit: 202.5 });
    expect(pick(ranges[30], "minutes")).toEqual({ body: 273, mind: 381, bonds: 126, craft: 189, spirit: 126 });
  });

  it("character and attribute levels", () => {
    const total = totalPoints(ranges.all);
    expect(total).toBe(725);
    expect(characterLevel(total).level).toBe(2);
    expect(Object.fromEntries(ATTRIBUTES.map((a) => [a, attributeLevel(ranges.all[a].points).level]))).toEqual({
      body: 1, mind: 2, bonds: 2, craft: 2, spirit: 1,
    });
  });

  it("per-quest points and time", () => {
    const today = dayKey(SAMPLE_NOW, SAMPLE_TZ);
    const rows = db.quests
      .filter((q) => q.type !== "system")
      .map((q) => {
        const s = questStats(q, db.checkpoints.filter((c) => c.questId === q.id), today);
        return [q.title, s.points, s.minutes];
      });
    expect(rows).toEqual([
      ["Launch Compass", 85, 360],
      ["Run a 10K", 160, 645],
      ["Stay close to grandmother", 138, 675],
      ["Read 12 books this year", 190, 840],
      ["Weekend trip with friends", 7, 30],
      ["Set up the new flat", 145, 720],
    ]);
  });

  it("12-week chart", () => {
    const weeks = weeklyHours(db.quests, db.checkpoints, { now: SAMPLE_NOW, tz: SAMPLE_TZ });
    expect(weeks.map((w) => w.weekStart)).toEqual([
      "2026-07-13", "2026-07-20", "2026-07-27", "2026-08-03", "2026-08-10", "2026-08-17",
      "2026-08-24", "2026-08-31", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28",
    ]);
    expect(weeks.map((w) => Math.round(w.total * 100) / 100)).toEqual([8, 3, 0, 5.75, 0.5, 0.5, 1, 5, 2.25, 1, 5.5, 4.5]);
  });
});
