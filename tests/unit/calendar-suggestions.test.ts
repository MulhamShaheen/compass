import { describe, expect, it } from "vitest";
import { matchingQuests, type CalendarQuest } from "@/lib/calendar/suggestions";
import type { CalendarRule } from "@/lib/calendar/types";

const quest: CalendarQuest = {
  id: "run", title: "Train for a 10K", type: "main", status: "active", primaryAttr: "body", secondaryAttr: "mind",
};
const rules: CalendarRule[] = [
  { id: "gym", match: "GYM", attribute: "body", questId: null },
  { id: "coach", match: "Coach", attribute: null, questId: "run" },
];

describe("calendar suggestions", () => {
  it("offers one active quest for overlapping title matches, ignoring case", () => {
    const quests: CalendarQuest[] = [
      quest, { ...quest, id: "pause", status: "paused" }, { ...quest, id: "prologue", type: "system" },
    ];
    expect(matchingQuests({ title: "Gym with coach" }, rules, quests)).toEqual([quest]);
  });

  it("matches secondary attributes and ignores unrelated titles", () => {
    const rule = [{ id: "club", match: "club", questId: null, attribute: "mind" as const }];
    expect(matchingQuests({ title: "Running club" }, rule, [quest])).toEqual([quest]);
    expect(matchingQuests({ title: "Dentist" }, rule, [quest])).toEqual([]);
  });
});
