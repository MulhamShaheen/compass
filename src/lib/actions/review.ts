"use server";

import { z } from "zod";
import { isUnlocked, prologueQuest, timezone } from "../db/derive";
import { ATTRIBUTES, habitSlots, REVIEW_PROMPT, reviewWeekFor } from "../game";
import { dayKey } from "../time";
import { fail, optionalText, run, type ActionResult } from "./run";

const reviewInput = z.object({
  note: optionalText(8000),
  ratings: z.partialRecord(z.enum(ATTRIBUTES), z.number().int().min(1).max(5)).default({}),
});

/** Step 3 of the weekly review. Steps 1 and 2 (look back, pause or resume quests) act directly. */
export async function completeWeeklyReview(input: z.input<typeof reviewInput>): Promise<ActionResult> {
  return run(reviewInput, input, (data, db, now) => {
    if (!isUnlocked(db, "weekly_review")) return fail("The weekly review opens on day 7.");
    const tz = timezone(db);
    const today = dayKey(now, tz);
    const week = reviewWeekFor(today);
    if (db.reviews.some((r) => r.weekStart === week)) return fail("This week is already reviewed. See you next week.");
    const at = now.toISOString();
    db.reviews.push({ id: crypto.randomUUID(), weekStart: week, note: data.note, completedAt: at });
    if (data.note) {
      db.journal.push({
        id: crypto.randomUUID(),
        day: today,
        prompt: REVIEW_PROMPT,
        body: data.note,
        weather: db.weather.find((w) => w.day === today)?.weather ?? null,
        createdAt: at,
      });
    }
    for (const [attribute, rating] of Object.entries(data.ratings)) {
      db.ratings.push({ id: crypto.randomUUID(), attribute: attribute as (typeof ATTRIBUTES)[number], rating, context: "weekly_review", ratedAt: at });
    }
    const prologue = prologueQuest(db);
    if (prologue) {
      db.checkpoints.push({
        id: crypto.randomUUID(), questId: prologue.id, occurredAt: at, title: `Weekly review · week of ${week}`,
        note: data.note, minutes: 0, isMilestone: db.reviews.length === 1, source: "system", createdAt: at,
      });
    }
    return { ok: true, message: `Week reviewed. You now have ${habitSlots(db.reviews.length)} habit slots.` };
  });
}
