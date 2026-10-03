import { describe, expect, it } from "vitest";
import {
  canActivateQuest,
  canAddHabit,
  cleanDays,
  dayNumber,
  evaluateUnlocks,
  habitSlots,
  habitStreak,
  last7,
  lockedHint,
  nextSideSlotLevel,
  promptIndex,
  questSlots,
  reviewWeekFor,
  shouldPromptReview,
  todayLoop,
  FEATURES,
  type UnlockState,
} from "@/lib/game";

describe("quest slots", () => {
  it("starts with 1 main and 3 side, +1 side at levels 3, 5 and 8", () => {
    expect(questSlots(1)).toEqual({ main: 1, side: 3 });
    expect(questSlots(3).side).toBe(4);
    expect(questSlots(5).side).toBe(5);
    expect(questSlots(8).side).toBe(6);
    expect(questSlots(20).side).toBe(6);
    expect(nextSideSlotLevel(1)).toBe(3);
    expect(nextSideSlotLevel(9)).toBeNull();
  });
  const quests = [
    { id: "a", type: "main" as const, status: "active" as const },
    { id: "b", type: "side" as const, status: "active" as const },
    { id: "c", type: "side" as const, status: "active" as const },
    { id: "d", type: "side" as const, status: "paused" as const },
  ];
  it("blocks a second main quest", () => {
    const r = canActivateQuest("main", quests, 1);
    expect(r.ok).toBe(false);
    expect(canActivateQuest("main", quests, 1, { excludeId: "a" }).ok).toBe(true);
  });
  it("paused quests free a slot", () => {
    expect(canActivateQuest("side", quests, 1).ok).toBe(true);
    const full = [...quests, { id: "e", type: "side" as const, status: "active" as const }];
    const r = canActivateQuest("side", full, 1);
    expect(r).toEqual({ ok: false, reason: expect.stringContaining("reach level 3") });
    expect(canActivateQuest("side", full, 3).ok).toBe(true);
    expect(canActivateQuest("side", [...full, { id: "f", type: "side", status: "active" }, { id: "g", type: "side", status: "active" }, { id: "h", type: "side", status: "active" }], 8)).toEqual({
      ok: false,
      reason: "All 6 side quest slots are in use. Pause one to make room.",
    });
  });
});

describe("habit slots", () => {
  it("starts with 2 and adds one per review up to 6", () => {
    expect(habitSlots(0)).toBe(2);
    expect(habitSlots(1)).toBe(3);
    expect(habitSlots(10)).toBe(6);
  });
  it("allows one keep and one starve before the first review", () => {
    expect(canAddHabit("keep", [], 0).ok).toBe(true);
    expect(canAddHabit("keep", [{ kind: "keep" }], 0).ok).toBe(false);
    expect(canAddHabit("starve", [{ kind: "keep" }], 0).ok).toBe(true);
    expect(canAddHabit("keep", [{ kind: "keep" }, { kind: "starve" }], 0).ok).toBe(false);
  });
  it("allows any mix after a review", () => {
    expect(canAddHabit("keep", [{ kind: "keep" }, { kind: "starve" }], 1).ok).toBe(true);
    expect(canAddHabit("keep", [{ kind: "keep" }, { kind: "keep" }, { kind: "starve" }], 1).ok).toBe(false);
  });
});

describe("unlocks", () => {
  const base: UnlockState = {
    startDay: "2026-10-01",
    today: "2026-10-01",
    checkinDays: 1,
    checkpoints: 1,
    questsWithCheckpoints: 1,
    totalPoints: 2,
    journalEntries: 0,
    weeklyReviews: 0,
  };
  it("a brand new character has nothing unlocked", () => {
    expect(evaluateUnlocks(base)).toEqual([]);
    expect(dayNumber(base.startDay, base.today)).toBe(1);
  });
  it("unlocks by play", () => {
    expect(evaluateUnlocks({ ...base, journalEntries: 1 })).toEqual(["prompts_rotate"]);
    expect(evaluateUnlocks({ ...base, checkinDays: 2 })).toEqual(["habits"]);
    expect(evaluateUnlocks({ ...base, checkpoints: 3 })).toEqual(["side_quests"]);
    expect(evaluateUnlocks({ ...base, totalPoints: 50 })).toEqual(["character"]);
    expect(evaluateUnlocks({ ...base, checkpoints: 5, questsWithCheckpoints: 1 })).toEqual(["side_quests"]);
    expect(evaluateUnlocks({ ...base, checkpoints: 5, questsWithCheckpoints: 2 })).toEqual(["side_quests", "where_life_goes"]);
    expect(evaluateUnlocks({ ...base, weeklyReviews: 1 })).toEqual(["calendar"]);
  });
  it("falls back to time so nobody gets stuck", () => {
    expect(evaluateUnlocks({ ...base, today: "2026-10-03" })).toEqual(["habits"]);
    expect(evaluateUnlocks({ ...base, today: "2026-10-04" })).toEqual(["habits", "side_quests"]);
    expect(evaluateUnlocks({ ...base, today: "2026-10-07" })).toEqual([
      "habits",
      "side_quests",
      "where_life_goes",
      "weekly_review",
    ]);
  });
  it("has a locked hint for every feature", () => {
    for (const f of FEATURES) expect(lockedHint(f, base)).toMatch(/^Opens/);
    expect(lockedHint("side_quests", base)).toContain("1 so far");
    expect(lockedHint("where_life_goes", base)).toContain("1 checkpoint on 1 quest");
  });
});

describe("habits", () => {
  const today = "2026-10-08";
  it("builds the 7-day strip oldest first", () => {
    expect(last7(["2026-10-08", "2026-10-02", "2026-09-01"], today)).toEqual([true, false, false, false, false, false, true]);
  });
  it("counts a streak through yesterday when today is not ticked yet", () => {
    expect(habitStreak(["2026-10-07", "2026-10-06", "2026-10-04"], today)).toBe(2);
    expect(habitStreak(["2026-10-08", "2026-10-07"], today)).toBe(2);
    expect(habitStreak(["2026-10-05"], today)).toBe(0);
    expect(habitStreak([], today)).toBe(0);
  });
  it("counts clean days for habits to starve", () => {
    expect(cleanDays(["2026-10-07", "2026-10-04"], today)).toBe(5);
  });
});

describe("today loop and prompts", () => {
  it("derives the three steps from the day's activity", () => {
    expect(todayLoop({ weatherDays: ["2026-10-08"], checkpointDays: ["2026-10-07"], journalDays: ["2026-10-08"] }, "2026-10-08")).toEqual({
      checkin: true,
      play: false,
      log: true,
    });
  });
  it("rotates prompts by day once unlocked", () => {
    expect(promptIndex("2026-10-01", "2026-10-03", false)).toBe(0);
    expect(promptIndex("2026-10-01", "2026-10-03", true)).toBe(2);
    expect(promptIndex("2026-10-01", "2026-10-08", true)).toBe(0);
    expect(promptIndex("2026-10-01", "2026-09-30", true)).toBe(6);
  });
});

describe("weekly review timing", () => {
  it("reviews the current week until Sunday, and last week on Monday", () => {
    expect(reviewWeekFor("2026-10-04")).toBe("2026-09-28"); // Sunday
    expect(reviewWeekFor("2026-10-05")).toBe("2026-09-28"); // Monday
    expect(reviewWeekFor("2026-10-07")).toBe("2026-10-05"); // Wednesday
  });
  it("prompts on Sunday and Monday only, if not done", () => {
    expect(shouldPromptReview("2026-10-04", [])).toBe(true);
    expect(shouldPromptReview("2026-10-05", [])).toBe(true);
    expect(shouldPromptReview("2026-10-05", ["2026-09-28"])).toBe(false);
    expect(shouldPromptReview("2026-10-07", [])).toBe(false);
  });
});
