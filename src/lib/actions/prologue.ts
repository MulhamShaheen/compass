"use server";

import { z } from "zod";
import { ATTRIBUTES, WEATHERS, WEATHER_NAMES, ATTRIBUTE_NAMES } from "../game";
import type { Checkpoint } from "../db/schema";
import { dayKey, isValidTimeZone } from "../time";
import { NORTH_PLACEHOLDER } from "../copy";
import { fail, optionalText, run, text, type ActionResult } from "./run";

const prologueInput = z.object({
  timezone: z.string().refine(isValidTimeZone, "Unknown timezone."),
  characterName: optionalText(60),
  chapterTitle: optionalText(80),
  trueNorth: optionalText(300),
  ratings: z.partialRecord(z.enum(ATTRIBUTES), z.number().int().min(1).max(5)).default({}),
  quest: z.object({
    title: text(120, "Name your first quest."),
    why: optionalText(400),
    primaryAttr: z.enum(ATTRIBUTES),
    secondaryAttr: z.enum(ATTRIBUTES).nullable().optional(),
    note: optionalText(2000),
  }),
  weather: z.enum(WEATHERS).nullable().optional(),
});

export type PrologueInput = z.input<typeof prologueInput>;


/**
 * Creates everything the Prologue collects in one go: profile, first chapter,
 * baseline ratings, the first main quest with "The quest begins", the first
 * weather log, and the hidden system quest that records how the story started.
 */
export async function completePrologue(input: PrologueInput): Promise<ActionResult> {
  return run(prologueInput, input, (data, db, now) => {
    if (db.profile?.prologueCompletedAt) return fail("The Prologue is already written.");
    const at = now.toISOString();
    const today = dayKey(now, data.timezone);
    const step = (title: string, note: string | null, isMilestone = false): Checkpoint => ({
      id: crypto.randomUUID(),
      questId: prologueId,
      occurredAt: at,
      title,
      note,
      minutes: 0,
      isMilestone,
      source: "system",
      createdAt: at,
    });

    db.profile = {
      characterName: data.characterName,
      trueNorth: data.trueNorth ?? NORTH_PLACEHOLDER,
      timezone: data.timezone,
      quietMode: false,
      prologueCompletedAt: at,
      createdAt: db.profile?.createdAt ?? at,
    };
    const chapterId = crypto.randomUUID();
    db.chapters.push({ id: chapterId, title: data.chapterTitle ?? "Chapter 1 · Beginnings", startedOn: today, endedOn: null });

    for (const [attribute, rating] of Object.entries(data.ratings)) {
      db.ratings.push({ id: crypto.randomUUID(), attribute: attribute as (typeof ATTRIBUTES)[number], rating, context: "baseline", ratedAt: at });
    }

    const prologueId = crypto.randomUUID();
    db.quests.push({
      id: prologueId, chapterId, type: "system", status: "done", title: "Prologue", why: "How the story started.",
      primaryAttr: "spirit", secondaryAttr: null, startedOn: today, completedAt: at, createdAt: at,
    });

    const questId = crypto.randomUUID();
    const q = data.quest;
    db.quests.push({
      id: questId, chapterId, type: "main", status: "active", title: q.title, why: q.why, primaryAttr: q.primaryAttr,
      secondaryAttr: q.secondaryAttr && q.secondaryAttr !== q.primaryAttr ? q.secondaryAttr : null,
      startedOn: today, completedAt: null, createdAt: at,
    });
    db.checkpoints.push({
      id: crypto.randomUUID(), questId, occurredAt: at, title: "The quest begins", note: q.note,
      minutes: 0, isMilestone: false, source: "system", createdAt: at,
    });

    if (data.weather) db.weather.push({ day: today, weather: data.weather });

    const steps: Checkpoint[] = [];
    if (data.characterName || data.chapterTitle) {
      steps.push(step("Named the character", [data.characterName, data.chapterTitle].filter(Boolean).join(" · ")));
    }
    if (data.trueNorth) steps.push(step("Found a True North", data.trueNorth));
    const rated = Object.entries(data.ratings);
    if (rated.length) {
      steps.push(step("Took stock", rated.map(([a, r]) => `${ATTRIBUTE_NAMES[a as keyof typeof ATTRIBUTE_NAMES]} ${r}/5`).join(" · ")));
    }
    steps.push(step("Chose the first quest", q.title));
    if (data.weather) steps.push(step("First check-in", `The weather: ${WEATHER_NAMES[data.weather]}`));
    steps.push(step("The story starts today", null, true));
    db.checkpoints.push(...steps);

    return { ok: true, message: "Your story starts today." };
  });
}
