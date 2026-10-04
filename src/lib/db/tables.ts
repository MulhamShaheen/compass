import type { Feature } from "../game/unlocks";
import type { Weather } from "../game/types";
import { emptyDb, type Db, type Profile } from "./schema";
import type { Database, Tables } from "./types";

/**
 * Mapping between the in-memory model (src/lib/db/schema.ts) and the Supabase
 * tables, plus change detection. Pure: no I/O, so it is unit-tested directly.
 *
 * The app loads one character's rows into a Db, actions change the Db, and
 * diffDb() works out which rows to upsert and delete.
 */

type TableName = keyof Database["public"]["Tables"];
type Row = Record<string, unknown>;
type CollectionKey = "chapters" | "quests" | "checkpoints" | "habits" | "habitLogs" | "weather" | "journal" | "ratings" | "unlocks" | "reviews";

const iso = (v: string | null | undefined): string | null => (v ? new Date(v).toISOString() : null);

interface Spec {
  key: CollectionKey;
  table: TableName;
  /** Columns that identify a row (the primary key, minus user_id where it is part of it). */
  keyCols: string[];
  /** Conflict target for upserts. */
  onConflict: string;
  toRow: (item: never, userId: string) => Row;
}

const spec = <K extends CollectionKey>(s: {
  key: K;
  table: TableName;
  keyCols: string[];
  onConflict: string;
  toRow: (item: Db[K][number], userId: string) => Row;
}): Spec => s as unknown as Spec;

/** In write order: parents before children. Deletes run in reverse. */
export const SPECS: Spec[] = [
  spec({
    key: "chapters", table: "chapters", keyCols: ["id"], onConflict: "id",
    toRow: (c, user_id) => ({ id: c.id, user_id, title: c.title, started_on: c.startedOn, ended_on: c.endedOn }),
  }),
  spec({
    key: "quests", table: "quests", keyCols: ["id"], onConflict: "id",
    toRow: (q, user_id) => ({
      id: q.id, user_id, chapter_id: q.chapterId, type: q.type, status: q.status, title: q.title, why: q.why,
      primary_attr: q.primaryAttr, secondary_attr: q.secondaryAttr, started_on: q.startedOn,
      completed_at: q.completedAt, created_at: q.createdAt,
    }),
  }),
  spec({
    key: "checkpoints", table: "checkpoints", keyCols: ["id"], onConflict: "id",
    toRow: (c, user_id) => ({
      id: c.id, user_id, quest_id: c.questId, occurred_at: c.occurredAt, title: c.title, note: c.note,
      minutes: c.minutes, is_milestone: c.isMilestone, source: c.source, created_at: c.createdAt,
    }),
  }),
  spec({
    key: "habits", table: "habits", keyCols: ["id"], onConflict: "id",
    toRow: (h, user_id) => ({ id: h.id, user_id, name: h.name, kind: h.kind, archived_at: h.archivedAt, created_at: h.createdAt }),
  }),
  spec({
    key: "habitLogs", table: "habit_logs", keyCols: ["habit_id", "day"], onConflict: "habit_id,day",
    toRow: (l, user_id) => ({ habit_id: l.habitId, user_id, day: l.day }),
  }),
  spec({
    key: "weather", table: "weather_logs", keyCols: ["day"], onConflict: "user_id,day",
    toRow: (w, user_id) => ({ user_id, day: w.day, weather: w.weather }),
  }),
  spec({
    key: "journal", table: "journal_entries", keyCols: ["id"], onConflict: "id",
    toRow: (j, user_id) => ({ id: j.id, user_id, day: j.day, prompt: j.prompt, body: j.body, weather: j.weather, created_at: j.createdAt }),
  }),
  spec({
    key: "ratings", table: "attribute_ratings", keyCols: ["id"], onConflict: "id",
    toRow: (r, user_id) => ({ id: r.id, user_id, attribute: r.attribute, rating: r.rating, context: r.context, rated_at: r.ratedAt }),
  }),
  spec({
    key: "unlocks", table: "unlocks", keyCols: ["feature"], onConflict: "user_id,feature",
    toRow: (u, user_id) => ({ user_id, feature: u.feature, unlocked_at: u.unlockedAt, seen_at: u.seenAt }),
  }),
  spec({
    key: "reviews", table: "weekly_reviews", keyCols: ["id"], onConflict: "id",
    toRow: (r, user_id) => ({ id: r.id, user_id, week_start: r.weekStart, note: r.note, completed_at: r.completedAt }),
  }),
];

export interface TableChange {
  table: TableName;
  onConflict: string;
  upserts: Row[];
  /** Key column values of rows to delete. */
  deletes: Row[];
}

const keyOf = (row: Row, cols: string[]) => cols.map((c) => String(row[c])).join("|");
const pick = (row: Row, cols: string[]) => Object.fromEntries(cols.map((c) => [c, row[c]]));

/** Row changes needed to turn `before` into `after`, in a safe write order. Empty tables are left out. */
export function diffDb(before: Db, after: Db, userId: string): TableChange[] {
  const changes: TableChange[] = [];
  for (const s of SPECS) {
    const old = new Map((before[s.key] as never[]).map((i) => s.toRow(i, userId)).map((r) => [keyOf(r, s.keyCols), r]));
    const next = new Map((after[s.key] as never[]).map((i) => s.toRow(i, userId)).map((r) => [keyOf(r, s.keyCols), r]));
    const upserts = [...next].filter(([k, r]) => JSON.stringify(old.get(k)) !== JSON.stringify(r)).map(([, r]) => r);
    const deletes = [...old].filter(([k]) => !next.has(k)).map(([, r]) => pick(r, s.keyCols));
    if (upserts.length || deletes.length) changes.push({ table: s.table, onConflict: s.onConflict, upserts, deletes });
  }
  return changes;
}

export function profileToRow(db: Db): Partial<Tables<"profiles">> {
  const p = db.profile;
  return {
    character_name: p?.characterName ?? null,
    true_north: p?.trueNorth ?? null,
    timezone: p?.timezone ?? "UTC",
    quiet_mode: p?.quietMode ?? false,
    prologue_completed_at: p?.prologueCompletedAt ?? null,
    dev_day_offset: db.dev.dayOffset,
  };
}

export interface LoadedRows {
  profile: Tables<"profiles"> | null;
  chapters: Tables<"chapters">[];
  quests: Tables<"quests">[];
  checkpoints: Tables<"checkpoints">[];
  habits: Tables<"habits">[];
  habit_logs: Tables<"habit_logs">[];
  weather_logs: Tables<"weather_logs">[];
  journal_entries: Tables<"journal_entries">[];
  attribute_ratings: Tables<"attribute_ratings">[];
  unlocks: Tables<"unlocks">[];
  weekly_reviews: Tables<"weekly_reviews">[];
  prompts: Tables<"prompts">[];
}

/** Builds the in-memory model from a user's rows. Timestamps are normalised to ISO strings in UTC. */
export function rowsToDb(r: LoadedRows): Db {
  const db = emptyDb();
  const p = r.profile;
  const profile: Profile | null =
    p && p.prologue_completed_at
      ? {
          characterName: p.character_name,
          trueNorth: p.true_north,
          timezone: p.timezone,
          quietMode: p.quiet_mode,
          prologueCompletedAt: iso(p.prologue_completed_at),
          createdAt: iso(p.created_at)!,
        }
      : null;
  db.profile = profile;
  db.dev.dayOffset = p?.dev_day_offset ?? 0;
  db.chapters = r.chapters.map((c) => ({ id: c.id, title: c.title, startedOn: c.started_on, endedOn: c.ended_on }));
  db.quests = r.quests.map((q) => ({
    id: q.id, chapterId: q.chapter_id, type: q.type, status: q.status, title: q.title, why: q.why,
    primaryAttr: q.primary_attr, secondaryAttr: q.secondary_attr, startedOn: q.started_on,
    completedAt: iso(q.completed_at), createdAt: iso(q.created_at)!,
  }));
  db.checkpoints = r.checkpoints.map((c) => ({
    id: c.id, questId: c.quest_id, occurredAt: iso(c.occurred_at)!, title: c.title, note: c.note,
    minutes: c.minutes, isMilestone: c.is_milestone, source: c.source, createdAt: iso(c.created_at)!,
  }));
  db.habits = r.habits.map((h) => ({ id: h.id, name: h.name, kind: h.kind, archivedAt: iso(h.archived_at), createdAt: iso(h.created_at)! }));
  db.habitLogs = r.habit_logs.map((l) => ({ habitId: l.habit_id, day: l.day }));
  db.weather = r.weather_logs.map((w) => ({ day: w.day, weather: w.weather as Weather }));
  db.journal = r.journal_entries.map((j) => ({
    id: j.id, day: j.day, prompt: j.prompt, body: j.body, weather: (j.weather as Weather | null) ?? null, createdAt: iso(j.created_at)!,
  }));
  db.ratings = r.attribute_ratings.map((x) => ({ id: x.id, attribute: x.attribute, rating: x.rating, context: x.context, ratedAt: iso(x.rated_at)! }));
  db.unlocks = r.unlocks.map((u) => ({ feature: u.feature as Feature, unlockedAt: iso(u.unlocked_at)!, seenAt: iso(u.seen_at) }));
  db.reviews = r.weekly_reviews.map((w) => ({ id: w.id, weekStart: w.week_start, note: w.note, completedAt: iso(w.completed_at)! }));
  const prompts = [...r.prompts].filter((x) => x.active).sort((a, b) => a.sort - b.sort).map((x) => x.text);
  if (prompts.length) db.prompts = prompts;
  return db;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * For importing older JSON state: replaces any non-UUID ids (the early sample used
 * "quest-1" style ids) with UUIDs and rewrites the references to them.
 */
export function withUuids(db: Db, newId: () => string = () => crypto.randomUUID()): Db {
  const map = new Map<string, string>();
  const fix = (id: string) => {
    if (UUID.test(id)) return id;
    if (!map.has(id)) map.set(id, newId());
    return map.get(id)!;
  };
  return {
    ...db,
    chapters: db.chapters.map((c) => ({ ...c, id: fix(c.id) })),
    quests: db.quests.map((q) => ({ ...q, id: fix(q.id), chapterId: q.chapterId ? fix(q.chapterId) : null })),
    checkpoints: db.checkpoints.map((c) => ({ ...c, id: fix(c.id), questId: fix(c.questId) })),
    habits: db.habits.map((h) => ({ ...h, id: fix(h.id) })),
    habitLogs: db.habitLogs.map((l) => ({ ...l, habitId: fix(l.habitId) })),
    journal: db.journal.map((j) => ({ ...j, id: fix(j.id) })),
    ratings: db.ratings.map((r) => ({ ...r, id: fix(r.id) })),
    reviews: db.reviews.map((r) => ({ ...r, id: fix(r.id) })),
  };
}
