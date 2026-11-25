import "server-only";
import { isDeepStrictEqual } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { isLocalMode } from "../supabase/env";
import { createClient, currentUser } from "../supabase/server";
import { isReviewEntry } from "./derive";
import { readDb, writeDb } from "./local-store";
import { emptyDb, type Db } from "./schema";
import { diffDb, profileToRow, rowsToDb, withUuids, type LoadedRows } from "./tables";

/**
 * The one door to stored data. Pages and actions call loadDb / saveDb and never
 * talk to Supabase or the file system directly.
 *
 * Supabase mode loads one character's rows into the in-memory model and, on save,
 * writes only the rows that changed (see tables.ts). The user id always comes from
 * the verified session, never from the client, and Row Level Security limits every
 * query to that user. Writes are not one transaction: a failure midway can leave a
 * partial change, which the next save completes or the user retries.
 */

export const NEXT_STEP_CHANGED = "Your next step changed. Open Today to see the latest version.";
export class NextStepWriteError extends Error {}
export class EventWriteError extends Error {}

export class SignedOutError extends Error {
  constructor() {
    super("Your session ended. Sign in again.");
  }
}

/** What each loaded Db looked like when it came out of the database. */
const snapshots = new WeakMap<Db, Db>();
const PAGE = 1000;

type AnyClient = SupabaseClient;

async function requireUser() {
  const user = await currentUser();
  if (!user) throw new SignedOutError();
  return user;
}

async function fetchAll<T>(sb: AnyClient, table: string, userId: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = sb.from(table).select("*").eq("user_id", userId);
    if (table === "compass_events") query = query.order("starts_at").order("id");
    const { data, error } = await query.range(from, from + PAGE - 1);
    // Keep the dashboard available before the Events migration is applied.
    if (table === "compass_events" && (error?.code === "42P01" || error?.code === "PGRST205")) return [];
    if (error) throw new Error(`Could not load ${table}: ${error.message}`);
    out.push(...(data as T[]));
    if (data.length < PAGE) return out;
  }
}

async function loadNextSteps(sb: AnyClient, userId: string): Promise<LoadedRows["today_next_steps"]> {
  const { data, error } = await sb.from("today_next_steps").select("*").eq("user_id", userId);
  // The rest of Compass still works while the migration is awaiting deployment.
  if (error?.code === "42P01" || error?.code === "PGRST205") return [];
  if (error) throw new Error(`Could not load the next step: ${error.message}`);
  return data;
}

async function loadRows(sb: AnyClient, userId: string): Promise<LoadedRows> {
  const [profile, chapters, quests, checkpoints, compass_events, today_next_steps, habits, habit_logs, weather_logs, journal_entries, attribute_ratings, unlocks, weekly_reviews, prompts] =
    await Promise.all([
      sb.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      fetchAll(sb, "chapters", userId),
      fetchAll(sb, "quests", userId),
      fetchAll(sb, "checkpoints", userId),
      fetchAll(sb, "compass_events", userId),
      loadNextSteps(sb, userId),
      fetchAll(sb, "habits", userId),
      fetchAll(sb, "habit_logs", userId),
      fetchAll(sb, "weather_logs", userId),
      fetchAll(sb, "journal_entries", userId),
      fetchAll(sb, "attribute_ratings", userId),
      fetchAll(sb, "unlocks", userId),
      fetchAll(sb, "weekly_reviews", userId),
      sb.from("prompts").select("*"),
    ]);
  if (profile.error) throw new Error(`Could not load your profile: ${profile.error.message}`);
  if (prompts.error) throw new Error(`Could not load prompts: ${prompts.error.message}`);
  return {
    profile: profile.data,
    chapters, quests, checkpoints, compass_events, today_next_steps, habits, habit_logs, weather_logs, journal_entries, attribute_ratings, unlocks, weekly_reviews,
    prompts: prompts.data ?? [],
  } as LoadedRows;
}

async function writeChanges(sb: AnyClient, userId: string, before: Db, after: Db, replacing = false): Promise<void> {
  const changes = diffDb(before, after, userId);
  const eventChange = changes.find((change) => change.table === "compass_events");
  if (eventChange && !replacing) {
    const previous = new Map(before.events.map((event) => [event.id, event.revision]));
    // A revision predicate prevents stale updates and removes from reviving or
    // overwriting an event after a concurrent write.
    for (const row of eventChange.upserts) {
      const revision = previous.get(String(row.id));
      const query = revision === undefined
        ? sb.from("compass_events").insert(row)
        : sb.from("compass_events").update(row).eq("user_id", userId).eq("id", row.id).eq("revision", revision);
      const { data, error } = await query.select("id").maybeSingle();
      if (error?.code === "42P01" || error?.code === "PGRST205") {
        throw new EventWriteError("Events will be available once the database update is applied.");
      }
      if (error?.code === "23503") throw new EventWriteError("A linked quest or checkpoint changed. Reload and choose the links again.");
      if (error) throw new EventWriteError("The event could not be saved. Please try again.");
      if (!data) throw new EventWriteError("The event changed while saving. Reload and try again.");
    }
    for (const row of eventChange.deletes) {
      const { data, error } = await sb.from("compass_events").delete().eq("user_id", userId)
        .eq("id", row.id).eq("revision", previous.get(String(row.id))!).select("id").maybeSingle();
      if (error?.code === "23503") throw new EventWriteError("Remove this event from Google Calendar before deleting it.");
      if (error) throw new EventWriteError("The event could not be deleted. Please try again.");
      if (!data) throw new EventWriteError("The event changed while deleting. Reload and try again.");
    }
    changes.splice(changes.indexOf(eventChange), 1);
  }
  // Normal plan changes compare revisions in Postgres. The RPC commits a
  // linked checkpoint with the removal of its plan in the same transaction.
  const planChange = changes.find((c) => c.table === "today_next_steps");
  const priorStep = before.nextSteps[0];
  // A quest status update removes its plan via trigger in the same transaction.
  const clearedByQuest = changes.find((c) => c.table === "quests")?.upserts.some(
    (q) => q.id === priorStep?.questId && q.status !== "active"
  );
  if (planChange && !replacing) changes.splice(changes.indexOf(planChange), 1);
  if (planChange && !replacing && !clearedByQuest) {
    const expected = priorStep?.id ?? null;
    const checkpoints = changes.find((c) => c.table === "checkpoints");
    const checkpoint = checkpoints?.upserts.find((row) => row.id === expected && row.source_ref === `next-step:${expected}`);
    const { data, error } = await sb.rpc("write_today_next_step", {
      p_expected: expected,
      p_step: planChange.upserts[0] ?? null,
      p_checkpoint: checkpoint ?? null,
    });
    if (error?.code === "PGRST202" || error?.code === "42883") {
      throw new NextStepWriteError("Next steps will be available once the database update is applied.");
    }
    if (error) throw new Error(`Could not save the next step: ${error.message}`);
    if (!data) throw new NextStepWriteError(NEXT_STEP_CHANGED);
    if (checkpoint && checkpoints) checkpoints.upserts = checkpoints.upserts.filter((row) => row !== checkpoint);
  }
  // Children first for deletes, parents first for upserts.
  for (const c of [...changes].reverse()) {
    if (!c.deletes.length) continue;
    const cols = Object.keys(c.deletes[0]);
    if (cols.length === 1) {
      const { error } = await sb.from(c.table).delete().eq("user_id", userId).in(cols[0], c.deletes.map((d) => d[cols[0]]));
      if (error) throw new Error(`Could not save (${c.table}): ${error.message}`);
    } else {
      for (const d of c.deletes) {
        const { error } = await sb.from(c.table).delete().eq("user_id", userId).match(d);
        if (error) throw new Error(`Could not save (${c.table}): ${error.message}`);
      }
    }
  }
  for (const c of changes) {
    if (!c.upserts.length) continue;
    const { error } = await sb.from(c.table).upsert(c.upserts, { onConflict: c.onConflict });
    if (error) throw new Error(`Could not save (${c.table}): ${error.message}`);
  }
  const profileBefore = profileToRow(before);
  const profileAfter = profileToRow(after);
  if (JSON.stringify(profileBefore) !== JSON.stringify(profileAfter)) {
    const { error } = await sb.from("profiles").upsert({ user_id: userId, ...profileAfter });
    if (error) throw new Error(`Could not save your profile: ${error.message}`);
  }
}

/**
 * One-time move of state saved by the earlier JSON-row version (prototype_state)
 * into the tables, for a user who has nothing in the tables yet.
 */
async function importLegacy(sb: AnyClient, userId: string, current: Db): Promise<Db | null> {
  const { data, error } = await sb.from("prototype_state").select("doc").eq("user_id", userId).maybeSingle();
  if (error || !data?.doc) return null;
  const legacy = withUuids({ ...emptyDb(), ...(data.doc as Partial<Db>) });
  legacy.prompts = current.prompts;
  await writeChanges(sb, userId, current, legacy, true);
  await sb.from("prototype_state").delete().eq("user_id", userId);
  return legacy;
}

export async function loadDb(): Promise<Db> {
  if (isLocalMode()) {
    const db = readDb();
    snapshots.set(db, structuredClone(db));
    return db;
  }
  const user = await requireUser();
  const sb = (await createClient()) as unknown as AnyClient;
  const rows = await loadRows(sb, user.id);
  let db = rowsToDb(rows);
  if (!rows.profile?.prologue_completed_at && rows.quests.length === 0) {
    db = (await importLegacy(sb, user.id, db)) ?? db;
  }
  snapshots.set(db, structuredClone(db));
  return db;
}

/**
 * Saves a Db that came from loadDb. To swap in a whole new state (sample, start
 * over), pass the loaded one as `replacing` so the old rows can be removed.
 */
export async function saveDb(db: Db, opts: { replacing?: Db } = {}): Promise<void> {
  if (opts.replacing) {
    if (!isLocalMode() && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const user = await requireUser();
      const { readGooglePublishing, disconnectGooglePublishing } = await import("../events/google-store");
      const publishing = await readGooglePublishing(user.id);
      if (publishing?.connected && !(await disconnectGooglePublishing(user.id))) {
        throw new EventWriteError("Wait for the current Google Calendar operation to finish.");
      }
    }
    const { calendarStore } = await import("../calendar/store");
    await (await calendarStore()).clear();
  }
  if (isLocalMode()) {
    const before = snapshots.get(db);
    if (before && !opts.replacing) {
      const current = readDb();
      if (current.nextSteps[0]?.id !== before.nextSteps[0]?.id) throw new NextStepWriteError(NEXT_STEP_CHANGED);
      if (db.nextSteps[0]?.id !== before.nextSteps[0]?.id && !isDeepStrictEqual(before, current)) {
        throw new NextStepWriteError("Your character changed while saving. Please try again.");
      }
      if (!isDeepStrictEqual(before.events, db.events)) {
        if (!isDeepStrictEqual(before, current)) throw new EventWriteError("Your character changed while saving. Please try again.");
      } else {
        // Preserve events saved by another action while this one was pending.
        db.events = current.events;
      }
      // Snapshot actions only append journal entries. Keep any newer inline edits
      // or deletions when a concurrent journal, quest or weather action saves.
      if (!isDeepStrictEqual(before.journal, current.journal)) {
        const priorIds = new Set(before.journal.map((entry) => entry.id));
        db.journal = [...current.journal, ...db.journal.filter((entry) => !priorIds.has(entry.id))];
      }
    }
    const questIds = new Set(db.quests.map((quest) => quest.id));
    const checkpointIds = new Set(db.checkpoints.map((checkpoint) => checkpoint.id));
    // Match the hosted ON DELETE SET NULL rules without dropping event history.
    for (const event of db.events) {
      const questId = event.questId && questIds.has(event.questId) ? event.questId : null;
      const checkpointId = questId && event.checkpointId && checkpointIds.has(event.checkpointId) ? event.checkpointId : null;
      if (event.questId !== questId || event.checkpointId !== checkpointId) {
        Object.assign(event, { questId, checkpointId, revision: event.revision + 1 });
      }
    }
    writeDb(db);
    snapshots.set(db, structuredClone(db));
    return;
  }
  const user = await requireUser();
  const before = snapshots.get(opts.replacing ?? db);
  if (!before) throw new Error("saveDb needs the Db returned by loadDb (or pass it as `replacing`).");
  const sb = (await createClient()) as unknown as AnyClient;
  await writeChanges(sb, user.id, before, db, !!opts.replacing);
  snapshots.set(db, structuredClone(db));
}

/** For pages: the data, or a trip to /login when the session has ended. */
export async function loadDbOrLogin(): Promise<Db> {
  try {
    return await loadDb();
  } catch (e) {
    if (e instanceof SignedOutError) redirect("/login");
    throw e;
  }
}

/** Deletes the signed-in account and, through cascades, every row it owns. */
export async function deleteAccount(): Promise<void> {
  if (isLocalMode()) {
    const { LocalCalendarStore } = await import("../calendar/local");
    await new LocalCalendarStore().clear();
    return writeDb(emptyDb());
  }
  await requireUser();
  const sb = await createClient();
  const { error } = await sb.rpc("delete_my_account");
  if (error) throw new Error(`Could not delete the account: ${error.message}`);
  await sb.auth.signOut();
}

/** Compare the entry as opened by the editor before changing or removing it. */
export async function writeJournalEntry(id: string, expected: string, body: string | null): Promise<boolean> {
  if (isLocalMode()) {
    const db = readDb();
    const entry = db.journal.find((j) => j.id === id);
    if (!entry || entry.body !== expected || isReviewEntry(db, entry)) return false;
    if (body === null) db.journal = db.journal.filter((j) => j.id !== id);
    else entry.body = body;
    writeDb(db);
    return true;
  }
  await requireUser();
  const sb = await createClient();
  const { data, error } = await sb.rpc("write_journal_entry", { p_id: id, p_expected: expected, p_body: body });
  if (error?.code === "PGRST202" || error?.code === "42883") {
    throw new JournalWriteError("Entry editing will be available after the database update.");
  }
  if (error) throw new JournalWriteError("Your change could not be saved. Please try again.");
  return data === true;
}

export class JournalWriteError extends Error {}
