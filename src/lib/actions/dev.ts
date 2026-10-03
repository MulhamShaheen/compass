"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { buildSample } from "../dev/sample";
import { appNow, syncUnlocks, timezone } from "../db/derive";
import { readDb, writeDb } from "../db/local-store";
import { emptyDb } from "../db/schema";
import type { ActionResult } from "./run";

/** Prototype-only tools for manual testing. Remove when Supabase auth lands. */

const shiftInput = z.object({ days: z.number().int().min(-30).max(30) });

export async function shiftClock(input: z.input<typeof shiftInput>): Promise<ActionResult> {
  const { days } = shiftInput.parse(input);
  const db = readDb();
  db.dev.dayOffset = Math.max(0, db.dev.dayOffset + days);
  syncUnlocks(db, appNow(db));
  writeDb(db);
  revalidatePath("/", "layout");
  return { ok: true, message: db.dev.dayOffset ? `Clock moved ${db.dev.dayOffset} day${db.dev.dayOffset === 1 ? "" : "s"} ahead` : "Back to real time" };
}

export async function resetClock(): Promise<ActionResult> {
  return shiftClock({ days: -30 });
}

export async function loadSample(input: { timezone?: string } = {}): Promise<ActionResult> {
  const current = readDb();
  const tz = input.timezone ?? timezone(current);
  writeDb(buildSample(new Date(), tz));
  revalidatePath("/", "layout");
  return { ok: true, message: "Sample character loaded" };
}

export async function startOver(): Promise<ActionResult> {
  writeDb(emptyDb());
  revalidatePath("/", "layout");
  return { ok: true };
}
