import { describe, expect, it } from "vitest";
import {
  attributeLevel,
  attributeTotals,
  characterLevel,
  checkpointPoints,
  splitByAttributes,
  totalPoints,
  type GameCheckpoint,
  type GameQuest,
} from "@/lib/game";

const quest = (over: Partial<GameQuest> = {}): GameQuest => ({
  id: "q1",
  type: "main",
  status: "active",
  primaryAttr: "body",
  secondaryAttr: null,
  ...over,
});
const cp = (over: Partial<GameCheckpoint> = {}): GameCheckpoint => ({
  questId: "q1",
  occurredAt: "2026-10-01T08:00:00Z",
  minutes: 60,
  isMilestone: false,
  ...over,
});

describe("checkpointPoints", () => {
  it("earns 1 point per 6 minutes", () => {
    expect(checkpointPoints({ minutes: 60, isMilestone: false })).toBe(10);
    expect(checkpointPoints({ minutes: 45, isMilestone: false })).toBe(8);
    expect(checkpointPoints({ minutes: 480, isMilestone: false })).toBe(80);
  });
  it("earns 2 points for a note with no time", () => {
    expect(checkpointPoints({ minutes: 0, isMilestone: false })).toBe(2);
  });
  it("adds 25 for a milestone", () => {
    expect(checkpointPoints({ minutes: 120, isMilestone: true })).toBe(45);
    expect(checkpointPoints({ minutes: 0, isMilestone: true })).toBe(27);
  });
});

describe("splitByAttributes", () => {
  it("gives everything to the primary attribute", () => {
    expect(splitByAttributes(quest(), 10)).toEqual([["body", 10]]);
  });
  it("splits 70/30 with a secondary attribute", () => {
    const [[a, x], [b, y]] = splitByAttributes(quest({ secondaryAttr: "spirit" }), 10);
    expect([a, b]).toEqual(["body", "spirit"]);
    expect(x).toBeCloseTo(7);
    expect(y).toBeCloseTo(3);
  });
  it("ignores a secondary that equals the primary", () => {
    expect(splitByAttributes(quest({ secondaryAttr: "body" }), 10)).toEqual([["body", 10]]);
  });
});

describe("attributeTotals", () => {
  it("sums points and minutes per attribute", () => {
    const t = attributeTotals([quest({ secondaryAttr: "mind" })], [cp(), cp({ minutes: 0, isMilestone: true })]);
    expect(t.body.points).toBeCloseTo((10 + 27) * 0.7);
    expect(t.mind.points).toBeCloseTo((10 + 27) * 0.3);
    expect(t.body.minutes).toBeCloseTo(42);
    expect(t.craft).toEqual({ points: 0, minutes: 0 });
  });
  it("skips system quests and unknown quests", () => {
    const t = attributeTotals(
      [quest({ type: "system" })],
      [cp(), cp({ questId: "missing" })],
    );
    expect(totalPoints(t)).toBe(0);
  });
  it("respects `since`", () => {
    const t = attributeTotals([quest()], [cp({ occurredAt: "2026-01-01T00:00:00Z" }), cp()], {
      since: new Date("2026-09-01T00:00:00Z"),
    });
    expect(t.body.points).toBe(10);
  });
  it("recomputes when a checkpoint is removed (nothing is stored)", () => {
    const cps = [cp(), cp({ minutes: 30 })];
    expect(totalPoints(attributeTotals([quest()], cps))).toBe(15);
    expect(totalPoints(attributeTotals([quest()], cps.slice(1)))).toBe(5);
  });
});

describe("levels", () => {
  it("attribute level rises every 150 points", () => {
    expect(attributeLevel(0)).toMatchObject({ level: 1, into: 0 });
    expect(attributeLevel(149)).toMatchObject({ level: 1, into: 149 });
    expect(attributeLevel(150)).toMatchObject({ level: 2, into: 0 });
    expect(attributeLevel(215.5).level).toBe(2);
  });
  it("character level rises every 400 points", () => {
    expect(characterLevel(399)).toMatchObject({ level: 1, into: 399, step: 400 });
    expect(characterLevel(725)).toMatchObject({ level: 2, into: 325 });
    expect(characterLevel(800).level).toBe(3);
    expect(characterLevel(200).progress).toBeCloseTo(0.5);
  });
  it("never goes below level 1", () => {
    expect(characterLevel(-5).level).toBe(1);
  });
});
