import { describe, expect, it } from "vitest";
import { emptyDb, type Db } from "@/lib/db/schema";
import { diffDb, profileToRow, rowsToDb, SPECS, withUuids, type LoadedRows } from "@/lib/db/tables";
import { sample } from "../fixtures/sample";

const UID = "00000000-0000-4000-8000-000000000001";

/** What the database would return for a Db: every spec's rows plus the profile row. */
function asRows(db: Db): LoadedRows {
  const rows = Object.fromEntries(SPECS.map((s) => [s.table, (db[s.key] as never[]).map((i) => s.toRow(i, UID))]));
  return {
    profile: {
      user_id: UID,
      ...profileToRow(db),
      waking_start: "07:00:00",
      waking_end: "23:00:00",
      created_at: db.profile?.createdAt ?? "2026-01-01T00:00:00.000Z",
    } as LoadedRows["profile"],
    ...rows,
    prompts: [],
  } as unknown as LoadedRows;
}

describe("rows <-> model", () => {
  it("round-trips the sample character", () => {
    const db = sample();
    expect(rowsToDb(asRows(db))).toEqual(db);
  });

  it("normalises Postgres timestamps to ISO strings in UTC", () => {
    const db = sample();
    const rows = asRows(db);
    rows.checkpoints[0].occurred_at = "2026-10-02T22:40:00+00:00";
    rows.checkpoints[0].created_at = "2026-10-02 22:40:00+00";
    const back = rowsToDb(rows);
    expect(back.checkpoints[0].occurredAt).toBe("2026-10-02T22:40:00.000Z");
    expect(back.checkpoints[0].createdAt).toBe("2026-10-02T22:40:00.000Z");
  });

  it("treats a profile without a finished Prologue as no profile, but keeps the dev clock", () => {
    const rows = asRows(emptyDb());
    rows.profile = { ...rows.profile!, prologue_completed_at: null, dev_day_offset: 3 };
    const db = rowsToDb(rows);
    expect(db.profile).toBeNull();
    expect(db.dev.dayOffset).toBe(3);
  });

  it("uses active prompts in their sort order", () => {
    const rows = asRows(emptyDb());
    rows.prompts = [
      { id: "b", user_id: null, text: "Second", sort: 2, active: true },
      { id: "a", user_id: null, text: "First", sort: 1, active: true },
      { id: "c", user_id: null, text: "Hidden", sort: 0, active: false },
    ];
    expect(rowsToDb(rows).prompts).toEqual(["First", "Second"]);
    expect(rowsToDb(asRows(emptyDb())).prompts).toBeUndefined();
  });
});

describe("diffDb", () => {
  it("finds nothing to write when nothing changed", () => {
    const db = sample();
    expect(diffDb(db, structuredClone(db), UID)).toEqual([]);
  });

  it("writes only the changed rows", () => {
    const before = sample();
    const after = structuredClone(before);
    after.checkpoints[3].title = "Renamed";
    after.weather.push({ day: "2026-10-02", weather: "clear" });
    const changes = diffDb(before, after, UID);
    expect(changes.map((c) => [c.table, c.upserts.length, c.deletes.length])).toEqual([
      ["checkpoints", 1, 0],
      ["weather_logs", 1, 0],
    ]);
    expect(changes[0].upserts[0]).toMatchObject({ id: before.checkpoints[3].id, title: "Renamed", user_id: UID });
  });

  it("deletes by key, including composite keys", () => {
    const before = sample();
    const after = structuredClone(before);
    const removed = after.checkpoints.pop()!;
    const log = after.habitLogs.shift()!;
    const changes = diffDb(before, after, UID);
    expect(changes.find((c) => c.table === "checkpoints")!.deletes).toEqual([{ id: removed.id }]);
    expect(changes.find((c) => c.table === "habit_logs")!.deletes).toEqual([{ habit_id: log.habitId, day: log.day }]);
  });

  it("orders parents before children", () => {
    const changes = diffDb(emptyDb(), sample(), UID).map((c) => c.table);
    expect(changes.indexOf("chapters")).toBeLessThan(changes.indexOf("quests"));
    expect(changes.indexOf("quests")).toBeLessThan(changes.indexOf("checkpoints"));
    expect(changes.indexOf("habits")).toBeLessThan(changes.indexOf("habit_logs"));
  });

  it("removes everything when starting over", () => {
    const before = sample();
    const changes = diffDb(before, emptyDb(), UID);
    const deleted = Object.fromEntries(changes.map((c) => [c.table, c.deletes.length]));
    expect(deleted.checkpoints).toBe(before.checkpoints.length);
    expect(changes.every((c) => c.upserts.length === 0)).toBe(true);
  });

  it("always writes the user id from the session, never from the data", () => {
    const rows = diffDb(emptyDb(), sample(), UID).flatMap((c) => c.upserts);
    expect(rows.every((r) => r.user_id === UID)).toBe(true);
  });
});

describe("withUuids", () => {
  it("replaces old non-UUID ids and keeps references intact", () => {
    const db = sample();
    const questId = db.quests[1].id;
    db.quests[1].id = "quest-2";
    for (const c of db.checkpoints) if (c.questId === questId) c.questId = "quest-2";
    const habitId = db.habits[0].id;
    db.habits[0].id = "habit-1";
    db.habitLogs = db.habitLogs.map((l) => (l.habitId === habitId ? { ...l, habitId: "habit-1" } : l));
    let n = 0;
    const fixed = withUuids(db, () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`);
    expect(fixed.quests[1].id).toBe("00000000-0000-4000-8000-000000000001");
    expect(fixed.checkpoints.filter((c) => c.questId === fixed.quests[1].id).length).toBeGreaterThan(0);
    expect(fixed.habitLogs.filter((l) => l.habitId === fixed.habits[0].id).length).toBeGreaterThan(0);
    expect(JSON.stringify(fixed)).not.toMatch(/quest-2|habit-1/);
    expect(fixed.quests[0].id).toBe(db.quests[0].id);
  });
});
