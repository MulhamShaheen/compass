import { describe, expect, it } from "vitest";
import {
  attributeTotals,
  emptyTotals,
  gapLabel,
  insight,
  questPulse,
  questStats,
  shareRows,
  weeklyHours,
  type GameCheckpoint,
  type GameQuest,
} from "@/lib/game";

const q: GameQuest = { id: "q", type: "side", status: "active", primaryAttr: "mind", secondaryAttr: null };
const cp = (occurredAt: string, minutes = 60, isMilestone = false): GameCheckpoint => ({
  questId: "q",
  occurredAt,
  minutes,
  isMilestone,
});

describe("shareRows and insight", () => {
  it("sorts by minutes and computes shares", () => {
    const t = emptyTotals();
    t.mind.minutes = 90;
    t.body.minutes = 30;
    const rows = shareRows(t);
    expect(rows[0]).toMatchObject({ attr: "mind", share: 0.75, relative: 1 });
    expect(rows[1]).toMatchObject({ attr: "body", share: 0.25 });
    expect(insight(t, 30)).toBe("Mind took the most of your time in the last 30 days. Spirit got the least (nothing logged).");
    expect(insight(t, null)).toMatch(/^Mind took the most of your time\./);
  });
  it("has a gentle empty state", () => {
    expect(insight(emptyTotals(), 90)).toMatch(/^Log checkpoints/);
    expect(shareRows(emptyTotals()).every((r) => r.share === 0)).toBe(true);
  });
  it("mentions the least attribute without the note when it has time", () => {
    const t = attributeTotals([q], [cp("2026-10-01T08:00:00Z")]);
    for (const a of ["body", "bonds", "craft", "spirit"] as const) t[a].minutes = 10;
    expect(insight(t, null)).not.toContain("nothing logged");
  });
});

describe("weeklyHours", () => {
  it("buckets by Monday-start weeks in the user's timezone", () => {
    // Sunday 23:30 in New York is Monday 03:30 UTC: it belongs to the earlier week there.
    const sundayNight = cp("2026-09-28T03:30:00Z", 120);
    const now = new Date("2026-10-02T12:00:00Z");
    const ny = weeklyHours([q], [sundayNight], { now, tz: "America/New_York", weeks: 2 });
    expect(ny.map((w) => w.weekStart)).toEqual(["2026-09-21", "2026-09-28"]);
    expect(ny[0].hours.mind).toBe(2);
    const utc = weeklyHours([q], [sundayNight], { now, tz: "UTC", weeks: 2 });
    expect(utc[1].hours.mind).toBe(2);
  });
  it("handles Europe/Moscow and ignores old and system checkpoints", () => {
    const now = new Date("2026-10-02T12:00:00Z");
    const sys: GameQuest = { ...q, id: "s", type: "system" };
    const w = weeklyHours(
      [q, sys],
      [cp("2026-09-27T21:30:00Z", 60), cp("2020-01-01T00:00:00Z"), { ...cp("2026-10-01T00:00:00Z"), questId: "s" }],
      { now, tz: "Europe/Moscow", weeks: 1 },
    );
    // 21:30 UTC Sunday is 00:30 Monday in Moscow, so it lands in this week.
    expect(w[0]).toMatchObject({ weekStart: "2026-09-28", total: 1 });
  });
  it("defaults to 12 weeks", () => {
    expect(weeklyHours([], [], { now: new Date(), tz: "UTC" })).toHaveLength(12);
  });
});

describe("questPulse", () => {
  it("counts checkpoints per week, milestones double", () => {
    const now = new Date("2026-10-02T12:00:00Z");
    const p = questPulse(
      [cp("2026-10-01T08:00:00Z"), cp("2026-09-30T08:00:00Z", 0, true), cp("2026-09-22T08:00:00Z"), cp("2025-01-01T00:00:00Z")],
      { now, tz: "UTC" },
    );
    expect(p).toHaveLength(16);
    expect(p[15]).toBe(3);
    expect(p[14]).toBe(1);
    expect(p.slice(0, 14).every((v) => v === 0)).toBe(true);
  });
});

describe("questStats and gapLabel", () => {
  it("summarises a thread", () => {
    const s = questStats({ startedOn: "2026-09-01" }, [cp("2026-09-02T00:00:00Z", 60, true), cp("2026-09-03T00:00:00Z", 0)], "2026-09-10");
    expect(s).toEqual({ startedOn: "2026-09-01", daysRunning: 10, checkpoints: 2, minutes: 60, points: 37 });
  });
  it("labels gaps", () => {
    expect(gapLabel("2026-09-01", "2026-09-08")).toBe("7-day gap");
    expect(gapLabel("2026-09-01", "2026-09-01")).toBe("same day");
  });
});
