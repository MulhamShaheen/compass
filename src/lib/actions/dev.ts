"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { buildSample } from "../dev/sample";
import { appNow, syncUnlocks, timezone } from "../db/derive";
import { emptyDb } from "../db/schema";
import { loadDb, saveDb, SignedOutError } from "../db/store";
import type { ActionResult } from "./run";

/**
 * Prototype tools for manual testing (the dashed debug bar). They only ever touch
 * the signed-in user's own data. Remove before the app is used for real.
 */

async function guarded(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof SignedOutError) return { ok: false, error: e.message };
    throw e;
  }
}

const shiftInput = z.object({ days: z.number().int().min(-30).max(30) });

export async function shiftClock(input: z.input<typeof shiftInput>): Promise<ActionResult> {
  const { days } = shiftInput.parse(input);
  return guarded(async () => {
    const db = await loadDb();
    db.dev.dayOffset = Math.max(0, db.dev.dayOffset + days);
    syncUnlocks(db, appNow(db));
    await saveDb(db);
    revalidatePath("/", "layout");
    return {
      ok: true,
      message: db.dev.dayOffset ? `Clock moved ${db.dev.dayOffset} day${db.dev.dayOffset === 1 ? "" : "s"} ahead` : "Back to real time",
    };
  });
}

export async function resetClock(): Promise<ActionResult> {
  return shiftClock({ days: -30 });
}

export async function loadSample(input: { timezone?: string } = {}): Promise<ActionResult> {
  return guarded(async () => {
    const current = await loadDb();
    const tz = input.timezone ?? timezone(current);
    await saveDb(buildSample(new Date(), tz));
    revalidatePath("/", "layout");
    return { ok: true, message: "Sample character loaded" };
  });
}

export async function startOver(): Promise<ActionResult> {
  return guarded(async () => {
    await saveDb(emptyDb());
    revalidatePath("/", "layout");
    return { ok: true };
  });
}
