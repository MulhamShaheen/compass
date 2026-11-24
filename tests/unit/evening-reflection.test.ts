import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createJournalEntry } from "@/lib/actions/daily";
import { NORTH_PLACEHOLDER } from "@/lib/copy";
import type { Checkpoint } from "@/lib/db/schema";
import { loadDb, saveDb } from "@/lib/db/store";
import { dailyReflection, reflectionQuestion } from "@/lib/game/daily";
import { sample } from "../fixtures/sample";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db/store", () => ({ loadDb: vi.fn(), saveDb: vi.fn(), NEXT_STEP_CHANGED: "Plan changed." }));

const now = new Date("2026-11-24T15:00:00Z");
const tz = "America/New_York";
const day = "2026-11-24";

function character() {
  const db = sample();
  db.profile!.timezone = tz;
  const quest = db.quests.find((q) => q.type === "side")!;
  quest.status = "done";
  const checkpoint: Checkpoint = {
    id: "morning", questId: quest.id, title: "Called my sister", note: null,
    occurredAt: "2026-11-24T05:00:00Z", createdAt: now.toISOString(),
    minutes: 20, isMilestone: false, source: "manual",
  };
  db.checkpoints = [
    checkpoint,
    { ...checkpoint, id: "yesterday", occurredAt: "2026-11-24T04:59:59Z" },
    { ...checkpoint, id: "later", occurredAt: now.toISOString(), source: "calendar" },
    { ...checkpoint, id: "automatic", source: "system" },
    { ...checkpoint, id: "prologue", questId: db.quests.find((q) => q.type === "system")!.id },
  ];
  return db;
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

it("offers user checkpoints by occurrence day in the profile timezone, newest first", () => {
  const db = character();
  db.profile!.trueNorth = NORTH_PLACEHOLDER;
  const reflection = dailyReflection(db, day, tz);
  expect(reflection.reflectionCheckpoints.map((c) => c.id)).toEqual(["later", "morning"]);
  expect(reflection.trueNorth).toBeNull();
  expect(reflectionQuestion(reflection.trueNorth)).toBe("Why did this moment matter to you?");
});

it("saves the owner's checkpoint and quest titles with the journal answer", async () => {
  const db = character();
  vi.mocked(loadDb).mockResolvedValue(db);
  const result = await createJournalEntry({ checkpointId: "morning", prompt: "Client wording", body: "It helped us reconnect." });
  expect(result.ok).toBe(true);
  const quest = db.quests.find((q) => q.id === db.checkpoints[0].questId)!;
  expect(db.journal.at(-1)).toMatchObject({
    day, body: "It helped us reconnect.",
    prompt: `${quest.title} · Called my sister — How did this moment connect to your True North?`,
  });
  expect(saveDb).toHaveBeenCalledOnce();
});

it.each(["yesterday", "prologue", "automatic", "deleted-or-unowned"])("rejects unavailable checkpoint %s without storing an entry", async (id) => {
  const db = character();
  vi.mocked(loadDb).mockResolvedValue(db);
  const before = db.journal.length;
  expect((await createJournalEntry({ checkpointId: id, body: "My reflection" })).ok).toBe(false);
  expect(db.journal).toHaveLength(before);
  expect(saveDb).not.toHaveBeenCalled();
});
