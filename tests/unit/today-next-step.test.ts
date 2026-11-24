import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { sample } from "../fixtures/sample";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({}));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compass-next-step-"));
const file = path.join(dir, "character.json");
let actions: typeof import("@/lib/actions/next-step");
let quests: typeof import("@/lib/actions/quests");
let store: typeof import("@/lib/db/store");

beforeAll(async () => {
  vi.stubEnv("COMPASS_DATA_FILE", file);
  vi.stubEnv("COMPASS_STORE", "local");
  actions = await import("@/lib/actions/next-step");
  quests = await import("@/lib/actions/quests");
  store = await import("@/lib/db/store");
});
beforeEach(() => {
  // Older files predate nextSteps.
  const { nextSteps, ...legacy } = sample();
  expect(nextSteps).toEqual([]);
  fs.writeFileSync(file, JSON.stringify(legacy));
});
afterAll(() => {
  vi.unstubAllEnvs();
  fs.rmSync(dir, { recursive: true, force: true });
});

it("rejects stale edits and stale checkpoint handoffs and keeps the accepted revision", async () => {
  const db = await store.loadDb();
  const questId = db.quests.find((q) => q.type === "main" && q.status === "active")!.id;
  const checkpointCount = db.checkpoints.length;
  const [first, second] = await Promise.all([
    actions.saveNextStep({ questId, expectedId: null, title: "One lap" }),
    actions.saveNextStep({ questId, expectedId: null, title: "Two laps" }),
  ]);
  expect([first, second].filter((r) => r.ok)).toHaveLength(1);
  const firstId = (await store.loadDb()).nextSteps[0].id;
  expect((await actions.saveNextStep({ questId, expectedId: firstId, title: "Walk to the park" })).ok).toBe(true);
  const nextStepId = (await store.loadDb()).nextSteps[0].id;
  expect((await actions.clearNextStep({ expectedId: firstId })).ok).toBe(false);
  const checkpoint = { questId, title: "Walked to the park", occurredAt: "2026-11-24T12:00", minutes: 22, isMilestone: false };
  expect((await quests.createCheckpoint({ ...checkpoint, nextStepId: firstId })).ok).toBe(false);
  expect((await store.loadDb()).checkpoints).toHaveLength(checkpointCount);
  expect((await quests.createCheckpoint({ ...checkpoint, nextStepId })).ok).toBe(true);
  expect((await quests.createCheckpoint({ ...checkpoint, nextStepId })).ok).toBe(true);
  const logged = await store.loadDb();
  expect(logged.checkpoints).toHaveLength(checkpointCount + 1);
  expect(logged.checkpoints.at(-1)).toMatchObject({ id: nextStepId, questId, title: checkpoint.title, minutes: 22 });
  expect(logged.nextSteps).toEqual([]);
});

it("keeps a plan through a direct checkpoint and clears it when its quest is paused", async () => {
  const questId = (await store.loadDb()).quests.find((q) => q.type === "main" && q.status === "active")!.id;
  await actions.saveNextStep({ expectedId: null, questId, title: "A short walk" });
  await quests.createCheckpoint({ questId, title: "Another run", occurredAt: "2026-11-24T12:00", minutes: 10, isMilestone: false });
  expect((await store.loadDb()).nextSteps[0]?.title).toBe("A short walk");
  await quests.setQuestStatus({ questId, status: "paused" });
  expect((await store.loadDb()).nextSteps).toEqual([]);
  expect((await actions.saveNextStep({ expectedId: null, questId, title: "Walk again" })).ok).toBe(false);
});

it("preserves an unrelated update made while a plan is being saved locally", async () => {
  const planEdit = await store.loadDb();
  const questId = planEdit.quests.find((q) => q.type === "main" && q.status === "active")!.id;
  planEdit.nextSteps = [{ id: crypto.randomUUID(), questId, day: "2026-11-24", title: "One lap" }];
  const updated = await store.loadDb();
  updated.dev.dayOffset += 1;
  await store.saveDb(updated);
  await expect(store.saveDb(planEdit)).rejects.toThrow("Please try again");
  const persisted = await store.loadDb();
  expect(persisted.nextSteps).toEqual([]);
  expect(persisted.dev.dayOffset).toBe(updated.dev.dayOffset);
});
