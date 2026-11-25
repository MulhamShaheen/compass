import { expect, it } from "vitest";
import { sync } from "node-ical";
import type { CompassEvent } from "@/lib/db/schema";
import { eventCalendar } from "@/lib/events/ics";
import { attributeTotals, eventPoints, totalPoints } from "@/lib/game/points";
import type { GameQuest } from "@/lib/game/types";

const event: CompassEvent = {
  id: "62e6e21f-6d81-49c2-95ae-45b271e93032",
  title: "Run, stretch; repeat " + "🌿".repeat(40),
  note: "First line\nSecond line",
  startsAt: "2026-11-25T12:30:00.000Z",
  endsAt: "2026-11-25T13:00:00.000Z",
  createdAt: "2026-11-25T11:00:00.000Z",
  completedAt: "2026-11-25T13:00:00.000Z",
  attribute: "body", questId: null, checkpointId: null, revision: 0,
};

it("awards points on completion and counts an associated checkpoint once", () => {
  const quest: GameQuest = { id: "quest", type: "main", status: "active", primaryAttr: "body", secondaryAttr: "spirit" };
  expect(eventPoints({ ...event, completedAt: null })).toBe(0);
  expect(attributeTotals([], [], { events: [event] }).body.points).toBe(5);
  const split = attributeTotals([quest], [], { events: [{ ...event, questId: quest.id }] });
  expect(split.body.points).toBeCloseTo(3.5);
  expect(split.spirit.points).toBeCloseTo(1.5);
  const totals = attributeTotals([quest], [{
    questId: quest.id, occurredAt: event.startsAt, minutes: 30, isMilestone: false,
  }], { events: [{ ...event, questId: quest.id, checkpointId: "checkpoint" }] });
  expect(totalPoints(totals)).toBe(5);
});

it("exports stable UTC events and safely folds Unicode and escaped text", () => {
  const ics = eventCalendar([event]);
  const lines = ics.split("\r\n");
  expect(lines.every((line) => Buffer.byteLength(line) <= 75)).toBe(true);
  expect(ics).toContain("DTSTART:20261125T123000Z\r\nDTEND:20261125T130000Z");
  expect(ics).toContain("DESCRIPTION:First line\\nSecond line");
  expect(ics.replace(/\r\n /g, "")).toContain("SUMMARY:Run\\, stretch\\; repeat " + "🌿".repeat(40));
  const imported = sync.parseICS(ics)[`${event.id}@compass`];
  expect(imported).toMatchObject({
    type: "VEVENT", summary: event.title, description: event.note, start: new Date(event.startsAt), end: new Date(event.endsAt),
  });
});
