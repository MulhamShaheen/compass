import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { appNow, syncUnlocks } from "../db/derive";
import { loadDb, saveDb, SignedOutError } from "../db/store";
import type { Db } from "../db/schema";
import { UNLOCK_COPY } from "../game";

export type ActionResult = { ok: true; message?: string; id?: string } | { ok: false; error: string };

export const fail = (error: string): ActionResult => ({ ok: false, error });

/**
 * Shared wrapper for server actions: validate input with zod, apply the change,
 * re-evaluate unlocks, persist, and refresh the pages. Nothing is written when
 * validation or a game rule fails.
 */
export async function run<S extends z.ZodType>(
  schema: S,
  input: unknown,
  fn: (data: z.infer<S>, db: Db, now: Date) => ActionResult,
): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Something in the form needs another look.");
  let db: Db;
  try {
    db = await loadDb();
  } catch (e) {
    if (e instanceof SignedOutError) return fail(e.message);
    throw e;
  }
  const now = appNow(db);
  const result = fn(parsed.data, db, now);
  if (!result.ok) return result;
  const fresh = syncUnlocks(db, now);
  await saveDb(db);
  revalidatePath("/", "layout");
  if (fresh.length && !result.message) {
    return { ...result, message: `Unlocked: ${fresh.map((f) => UNLOCK_COPY[f].title).join(", ")}` };
  }
  return result;
}

export const text = (max: number, message = "This needs a few words.") => z.string().trim().min(1, message).max(max);
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));
