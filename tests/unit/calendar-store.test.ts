import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import type { LocalCalendarStore } from "@/lib/calendar/local";
import type { CalendarInputEvent } from "@/lib/calendar/types";
import { emptyDb } from "@/lib/db/schema";

vi.mock("server-only", () => ({}));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compass-calendar-store-"));
const file = path.join(dir, "character.json");
let store: LocalCalendarStore;
const event: CalendarInputEvent = {
  externalId: "one", title: "Swim practice", start: "2025-01-10T10:00:00Z", end: "2025-01-10T11:00:00Z",
};
const secret = "private test credential";

beforeAll(async () => {
  vi.stubEnv("COMPASS_DATA_FILE", file);
  const { LocalCalendarStore } = await import("@/lib/calendar/local");
  store = new LocalCalendarStore();
});

beforeEach(async () => {
  await store.clear();
  const db = emptyDb();
  db.quests.push({ id: "q", title: "Swim", why: null, chapterId: null, type: "main", status: "active",
    primaryAttr: "body", secondaryAttr: null, startedOn: "2025-01-01", completedAt: null, createdAt: "2025-01-01T00:00:00Z" });
  fs.writeFileSync(file, JSON.stringify(db));
});

afterAll(() => {
  vi.unstubAllEnvs();
  fs.rmSync(dir, { recursive: true, force: true });
});

it("retains the latest complete sync and excludes credentials from user-facing data", async () => {
  const id = await store.addSource("ics", "Training", secret);
  await expect(store.addSource("ics", "Training", secret)).resolves.toBe(id);
  await expect(store.applySync(id, 0, { events: [event], replace: true, cursor: "provider cursor" })).resolves.toBe(true);
  await expect(store.applySync(id, 0, { events: [], replace: true })).resolves.toBe(false);
  const data = await store.load();
  expect(data.events).toHaveLength(1);
  expect(JSON.stringify(data)).not.toContain(secret);
  expect(JSON.stringify(data)).not.toContain("provider cursor");
  expect((await store.readSync(id)).cursor).toBe("provider cursor");
  expect(fs.statSync(file + ".calendar.json").mode & 0o777).toBe(0o600);
});

it("keeps one confirmed checkpoint after an occurrence disappears, returns and disconnects", async () => {
  const id = await store.addSource("ics", "Training", secret);
  await store.applySync(id, 0, { events: [event], replace: true });
  const eventId = (await store.load()).events[0].id;
  await expect(store.confirmEvent(eventId, "q")).rejects.toThrow();
  await store.addRule("swim", null, "body");
  await Promise.all([store.confirmEvent(eventId, "q"), store.confirmEvent(eventId, "q")]);
  await store.applySync(id, 1, { events: [], deleted: ["one"], replace: false });
  await store.applySync(id, 2, { events: [event], replace: true });
  expect((await store.load()).events[0].id).toBe(eventId);
  await store.confirmEvent(eventId, "q");
  await store.removeSource(id);
  await expect(store.applySync(id, 3, { events: [event], replace: true })).resolves.toBe(false);
  const data = await store.load();
  expect(data.confirmedIds).toEqual([eventId]);
  expect(data.events).toEqual([]);
  const db = JSON.parse(fs.readFileSync(file, "utf8"));
  expect(db.checkpoints).toEqual([expect.objectContaining({ source: "calendar", sourceRef: eventId, minutes: 60 })]);
});

it("invalidates old work and wipes the old events when Google is reconnected", async () => {
  const id = await store.addSource("google", "Primary", secret);
  await store.applySync(id, 0, { events: [event], replace: true, cursor: "old cursor" });
  expect(await store.addSource("google", "Primary", "new credential")).toBe(id);
  expect(await store.applySync(id, 1, { events: [event], replace: true })).toBe(false);
  const state = await store.readSync(id);
  expect(state.secret).toBe("new credential");
  expect(state.cursor).toBeNull();
  expect(state.source.lastSyncedAt).toBeNull();
  expect((await store.load()).events).toEqual([]);
});

it("keeps dismissed occurrences busy and hidden through refreshes until the source is removed", async () => {
  const sourceId = await store.addSource("ics", "Training", secret);
  await store.applySync(sourceId, 0, { events: [event], replace: true });
  const eventId = (await store.load()).events[0].id;
  await store.addRule("swim", "q", null);
  await store.dismissEvent(eventId);
  expect((await store.load()).events).toHaveLength(1);
  await store.applySync(sourceId, 1, { events: [], replace: true });
  await store.dismissEvent(eventId);
  await store.applySync(sourceId, 2, { events: [event], replace: true });
  await expect(store.confirmEvent(eventId, "q")).rejects.toThrow();
  expect((await store.load()).dismissedIds).toEqual([eventId]);
  await store.removeSource(sourceId);
  expect((await store.load()).dismissedIds).toEqual([]);
});
