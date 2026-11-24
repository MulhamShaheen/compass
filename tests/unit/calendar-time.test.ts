import { describe, expect, it } from "vitest";
import { calendarWeek, reviewCalendarTime } from "@/lib/game/time";

const opts = { now: new Date("2026-11-01T22:00:00Z"), tz: "Europe/Moscow" };

describe("calendar time", () => {
  it("uses the local Monday and clips merged overlapping events to waking hours", () => {
    const result = calendarWeek([
      { start: "2026-11-01T03:00:00Z", end: "2026-11-02T06:00:00Z" },
      { start: "2026-11-02T05:00:00Z", end: "2026-11-02T07:00:00Z" },
      { start: "2026-11-02T06:00:00Z", end: "2026-11-02T06:30:00Z" },
      { start: "2026-11-02T20:00:00Z", end: "2026-11-02T23:00:00Z" },
    ], opts);
    expect(result.weekStart).toBe("2026-11-02");
    expect(result.days).toHaveLength(7);
    expect(result.days[0]).toEqual({ day: "2026-11-02", awakeMinutes: 960, busyMinutes: 180, freeMinutes: 780 });
    expect(result.freeMinutes).toBe(7 * 960 - 180);
    expect(result.averageFreeMinutes).toBe(7 * 960 - 960 / 4);
  });

  it("uses local inclusive/exclusive boundaries for all-day events", () => {
    const result = calendarWeek([{ start: "2026-11-02", end: "2026-11-04" }], opts);
    expect(result.days.map((d) => d.busyMinutes)).toEqual([960, 960, 0, 0, 0, 0, 0]);
  });

  it.each([
    ["2026-03-08", 3 * 60],
    ["2026-11-01", 5 * 60],
  ])("uses elapsed time across the New York DST transition on %s", (day, minutes) => {
    const result = calendarWeek(
      [{ start: day + "T00:00:00-04:00", end: day + "T05:00:00-05:00" }],
      { now: new Date(day + "T12:00:00Z"), tz: "America/New_York", wakingStart: "00:00", wakingEnd: "04:00" },
    );
    expect(result.days[6]).toEqual({ day, awakeMinutes: minutes, busyMinutes: minutes, freeMinutes: 0 });
  });

  it("resolves a missing local wake time forward across the spring DST gap", () => {
    const result = calendarWeek([], { now: new Date("2026-03-08T12:00:00Z"), tz: "America/New_York", wakingStart: "02:30", wakingEnd: "04:00" });
    expect(result.days[6].awakeMinutes).toBe(30);
  });

  it("groups overnight waking hours into the local dates on which they occur", () => {
    const result = calendarWeek([{ start: "2026-11-02", end: "2026-11-03" }], { ...opts, wakingStart: "22:00", wakingEnd: "06:00" });
    expect(result.days[0].busyMinutes).toBe(480);
    expect(result.days[1].freeMinutes).toBe(480);
  });

  it("requires four full weeks when the caller supplies a sync boundary", () => {
    expect(calendarWeek([], { ...opts, coverageStart: "2026-10-06" }).averageFreeMinutes).toBeNull();
    expect(calendarWeek([], { ...opts, coverageStart: "2026-10-05" }).averageFreeMinutes).toBe(7 * 960);
  });
});

describe("weekly review calendar time", () => {
  const sync = "2026-11-01T21:00:00Z";
  const events = [
    { start: "2026-10-29T07:00:00+03:00", end: "2026-10-29T10:00:00+03:00" },
    { start: "2026-10-29T09:00:00+03:00", end: "2026-10-29T11:00:00+03:00" },
    { start: "2026-11-01", end: "2026-11-02" },
  ];

  it("looks back at the entire prior week on the local Monday", () => {
    expect(reviewCalendarTime(events, { ...opts, week: "2026-10-26", lastSyncs: [sync] }))
      .toEqual({ through: "2026-11-01", freeMinutes: 7 * 960 - 4 * 60 - 960 });
  });

  it("counts only completed dates when reviewing before the end of the week", () => {
    const now = new Date("2026-11-01T12:00:00Z");
    expect(reviewCalendarTime(events, { ...opts, now, week: "2026-10-26", lastSyncs: [now.toISOString()] }))
      .toEqual({ through: "2026-10-31", freeMinutes: 6 * 960 - 4 * 60 });
  });

  it("skips the reflection if there have been no completed days or a source is stale", () => {
    expect(reviewCalendarTime([], { ...opts, week: "2026-11-02", lastSyncs: [sync] })).toBeNull();
    for (const lastSyncs of [[], [sync, null], [sync, "2026-10-30T12:00:00Z"]]) {
      expect(reviewCalendarTime([], { ...opts, week: "2026-10-26", lastSyncs })).toBeNull();
    }
  });
});
