import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { REVIEW_PROMPT } from "@/lib/game/daily";
import { sample } from "../fixtures/sample";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({}));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "compass-journal-"));
const file = path.join(dir, "character.json");
let change: typeof import("@/lib/actions/daily").changeJournalEntry;
let store: typeof import("@/lib/db/store");

beforeAll(async () => {
  vi.stubEnv("COMPASS_STORE", "local");
  vi.stubEnv("COMPASS_DATA_FILE", file);
  ({ changeJournalEntry: change } = await import("@/lib/actions/daily"));
  store = await import("@/lib/db/store");
});
beforeEach(() => fs.writeFileSync(file, JSON.stringify(sample())));
afterAll(() => {
  vi.unstubAllEnvs();
  fs.rmSync(dir, { recursive: true, force: true });
});

it("preserves journal context on edit and rejects stale edits and deletions", async () => {
  const snapshot = await store.loadDb();
  const entry = snapshot.journal[0];
  const initial = { id: entry.id, expected: entry.body };
  expect((await change({ ...initial, body: "Revised note" })).ok).toBe(true);
  expect((await change({ ...initial, body: "Late edit" })).ok).toBe(false);
  expect((await change({ ...initial, body: null })).ok).toBe(false);
  expect((await store.loadDb()).journal[0]).toEqual({ ...entry, body: "Revised note" });
  expect((await change({ id: entry.id, expected: "Revised note", body: null })).ok).toBe(true);
  snapshot.dev.dayOffset++;
  await store.saveDb(snapshot);
  expect((await store.loadDb()).journal.some((j) => j.id === entry.id)).toBe(false);
});

it("protects the journal record attached to a completed weekly review", async () => {
  const db = sample();
  const entry = db.journal[0];
  entry.prompt = REVIEW_PROMPT;
  db.reviews.push({ id: "review", note: entry.body, completedAt: entry.createdAt, weekStart: entry.day });
  fs.writeFileSync(file, JSON.stringify(db));
  expect((await change({ id: entry.id, expected: entry.body, body: "Edited" })).ok).toBe(false);
  expect((await change({ id: entry.id, expected: entry.body, body: null })).ok).toBe(false);
  expect((await store.loadDb()).journal[0]).toEqual(entry);
});
