"use server";

import { z } from "zod";
import { timezone } from "../db/derive";
import { dayKey } from "../time";
import { fail, run, text, type ActionResult } from "./run";
import { NEXT_STEP_CHANGED } from "../db/store";

const saveInput = z.object({
  questId: z.string().min(1),
  title: text(160, "Write a few words for your next step."),
  expectedId: z.uuid().nullable(),
});

export async function saveNextStep(input: z.input<typeof saveInput>): Promise<ActionResult> {
  return run(saveInput, input, (data, db, now) => {
    if ((db.nextSteps[0]?.id ?? null) !== data.expectedId) return fail(NEXT_STEP_CHANGED);
    const quest = db.quests.find((q) => q.id === data.questId);
    if (!quest || quest.type !== "main" || quest.status !== "active") {
      return fail("Choose an active main quest for your next step.");
    }
    db.nextSteps = [{ id: crypto.randomUUID(), questId: quest.id, title: data.title, day: dayKey(now, timezone(db)) }];
    return { ok: true, message: "Next step saved." };
  });
}

const clearInput = z.object({ expectedId: z.uuid() });

export async function clearNextStep(input: z.input<typeof clearInput>): Promise<ActionResult> {
  return run(clearInput, input, (data, db) => {
    if (!db.nextSteps.length) return { ok: true };
    if (db.nextSteps[0].id !== data.expectedId) return fail(NEXT_STEP_CHANGED);
    db.nextSteps = [];
    return { ok: true, message: "Next step cleared." };
  });
}
