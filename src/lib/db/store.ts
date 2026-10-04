import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { isLocalMode } from "../supabase/env";
import { createClient, currentUser } from "../supabase/server";
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
    const { data, error } = await sb.from(table).select("*").eq("user_id", userId).range(from, from + PAGE - 1);
    if (error) throw new Error(`Could not load ${table}: ${error.message}`);
    out.push(...(data as T[]));
    if (data.length < PAGE) return out;
  }
}

async function loadRows(sb: AnyClient, userId: string): Promise<LoadedRows> {
  const [profile, chapters, quests, checkpoints, habits, habit_logs, weather_logs, journal_entries, attribute_ratings, unlocks, weekly_reviews, prompts] =
    await Promise.all([
      sb.from("profiles").select("*").eq("user_id", userId).maybeSingle(),
      fetchAll(sb, "chapters", userId),
      fetchAll(sb, "quests", userId),
      fetchAll(sb, "checkpoints", userId),
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
    chapters, quests, checkpoints, habits, habit_logs, weather_logs, journal_entries, attribute_ratings, unlocks, weekly_reviews,
    prompts: prompts.data ?? [],
  } as LoadedRows;
}

async function writeChanges(sb: AnyClient, userId: string, before: Db, after: Db): Promise<void> {
  const changes = diffDb(before, after, userId);
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
  await writeChanges(sb, userId, current, legacy);
  await sb.from("prototype_state").delete().eq("user_id", userId);
  return legacy;
}

export async function loadDb(): Promise<Db> {
  if (isLocalMode()) return readDb();
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
  if (isLocalMode()) return writeDb(db);
  const user = await requireUser();
  const before = snapshots.get(opts.replacing ?? db);
  if (!before) throw new Error("saveDb needs the Db returned by loadDb (or pass it as `replacing`).");
  const sb = (await createClient()) as unknown as AnyClient;
  await writeChanges(sb, user.id, before, db);
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
  if (isLocalMode()) return writeDb(emptyDb());
  await requireUser();
  const sb = await createClient();
  const { error } = await sb.rpc("delete_my_account");
  if (error) throw new Error(`Could not delete the account: ${error.message}`);
  await sb.auth.signOut();
}
