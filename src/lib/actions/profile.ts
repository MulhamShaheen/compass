"use server";

import { z } from "zod";
import { FEATURES } from "../game";
import { isValidTimeZone } from "../time";
import { fail, optionalText, run, type ActionResult } from "./run";
import { NORTH_PLACEHOLDER } from "../copy";

const northInput = z.object({ trueNorth: optionalText(300) });

export async function updateTrueNorth(input: z.input<typeof northInput>): Promise<ActionResult> {
  return run(northInput, input, (data, db) => {
    if (!db.profile) return fail("Start with the Prologue.");
    const next = data.trueNorth ?? NORTH_PLACEHOLDER;
    if (db.profile.trueNorth === next) return { ok: true };
    db.profile.trueNorth = next;
    return { ok: true, message: "True North saved" };
  });
}

const settingsInput = z.object({
  characterName: optionalText(60),
  chapterTitle: optionalText(80),
  timezone: z.string().refine(isValidTimeZone, "Unknown timezone."),
  quietMode: z.boolean(),
});

export async function updateSettings(input: z.input<typeof settingsInput>): Promise<ActionResult> {
  return run(settingsInput, input, (data, db) => {
    if (!db.profile) return fail("Start with the Prologue.");
    db.profile.characterName = data.characterName;
    db.profile.timezone = data.timezone;
    db.profile.quietMode = data.quietMode;
    const chapter = db.chapters.find((c) => !c.endedOn);
    if (chapter && data.chapterTitle) chapter.title = data.chapterTitle;
    return { ok: true, message: "Settings saved" };
  });
}

const dismissInput = z.object({ feature: z.enum(FEATURES) });

export async function dismissUnlock(input: z.input<typeof dismissInput>): Promise<ActionResult> {
  return run(dismissInput, input, (data, db, now) => {
    const unlock = db.unlocks.find((u) => u.feature === data.feature);
    if (unlock && !unlock.seenAt) unlock.seenAt = now.toISOString();
    return { ok: true };
  });
}
