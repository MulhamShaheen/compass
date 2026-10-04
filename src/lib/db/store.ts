import "server-only";
import { redirect } from "next/navigation";
import { isLocalMode } from "../supabase/env";
import { createClient, currentUser } from "../supabase/server";
import { readDb, writeDb } from "./local-store";
import { emptyDb, type Db } from "./schema";
import type { Json } from "./types";

/**
 * The one door to stored data. Pages and actions call loadDb / saveDb and never
 * talk to Supabase or the file system directly.
 *
 * Supabase mode keeps the character's whole state in its own prototype_state row
 * (a bridge until the full table model of plan step 3) and mirrors the profile
 * fields into public.profiles. The user id always comes from the verified session,
 * never from the client, and Row Level Security limits every query to that user.
 */

export class SignedOutError extends Error {
  constructor() {
    super("Your session ended. Sign in again.");
  }
}

export async function loadDb(): Promise<Db> {
  if (isLocalMode()) return readDb();
  const user = await currentUser();
  if (!user) throw new SignedOutError();
  const supabase = await createClient();
  const { data, error } = await supabase.from("prototype_state").select("doc").eq("user_id", user.id).maybeSingle();
  if (error) throw new Error(`Could not load your data: ${error.message}`);
  return data?.doc ? { ...emptyDb(), ...(data.doc as Partial<Db>) } : emptyDb();
}

export async function saveDb(db: Db): Promise<void> {
  if (isLocalMode()) return writeDb(db);
  const user = await currentUser();
  if (!user) throw new SignedOutError();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const state = await supabase.from("prototype_state").upsert({ user_id: user.id, doc: db as unknown as Json, updated_at: now });
  if (state.error) throw new Error(`Could not save: ${state.error.message}`);
  const p = db.profile;
  const profile = await supabase.from("profiles").upsert({
    user_id: user.id,
    character_name: p?.characterName ?? null,
    true_north: p?.trueNorth ?? null,
    timezone: p?.timezone ?? "UTC",
    quiet_mode: p?.quietMode ?? false,
    prologue_completed_at: p?.prologueCompletedAt ?? null,
  });
  if (profile.error) throw new Error(`Could not save your profile: ${profile.error.message}`);
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
