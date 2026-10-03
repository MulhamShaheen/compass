import { describe, expect, it } from "vitest";
import {
  addDays,
  dateToLocalInput,
  dayKey,
  daysBetween,
  formatDay,
  formatTime,
  formatToday,
  isValidTimeZone,
  localInputToDate,
  relativeDay,
  weekdayIndex,
  weekStart,
} from "@/lib/time";

describe("time helpers", () => {
  it("computes the day in the user's timezone", () => {
    const d = new Date("2026-10-02T22:30:00Z");
    expect(dayKey(d, "UTC")).toBe("2026-10-02");
    expect(dayKey(d, "Europe/Moscow")).toBe("2026-10-03");
    expect(dayKey(d, "America/New_York")).toBe("2026-10-02");
  });
  it("does day arithmetic across DST and month ends", () => {
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
    expect(daysBetween("2026-10-09", "2026-10-02")).toBe(-7);
  });
  it("starts weeks on Monday", () => {
    expect(weekdayIndex("2026-09-28")).toBe(0);
    expect(weekdayIndex("2026-10-04")).toBe(6);
    expect(weekStart("2026-10-04")).toBe("2026-09-28");
    expect(weekStart("2026-09-28")).toBe("2026-09-28");
  });
  it("round-trips datetime-local values through the user's timezone", () => {
    const d = localInputToDate("2026-03-08T07:30", "America/New_York");
    expect(d.toISOString()).toBe("2026-03-08T11:30:00.000Z");
    expect(dateToLocalInput(d, "America/New_York")).toBe("2026-03-08T07:30");
    expect(formatTime(d, "Europe/Moscow")).toBe("14:30");
  });
  it("formats days", () => {
    expect(formatDay("2026-10-02", "2026-12-01")).toBe("2 Oct");
    expect(formatDay("2025-10-02", "2026-12-01")).toBe("2 Oct 2025");
    expect(formatToday("2026-10-02")).toBe("Fri 2 Oct");
  });
  it("describes relative days", () => {
    const t = "2026-10-02";
    expect(relativeDay(t, t)).toBe("today");
    expect(relativeDay("2026-10-01", t)).toBe("yesterday");
    expect(relativeDay("2026-09-25", t)).toBe("7 days ago");
    expect(relativeDay("2026-09-11", t)).toBe("3 weeks ago");
    expect(relativeDay("2026-06-04", t)).toBe("4 months ago");
  });
  it("validates timezones", () => {
    expect(isValidTimeZone("Europe/Moscow")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});
