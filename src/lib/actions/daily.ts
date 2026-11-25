"use server";

import { revalidatePath } from "next/cache";
import { writeJournalEntry, JournalWriteError, SignedOutError } from "../db/store";
import { z } from "zod";
import { isUnlocked, timezone } from "../db/derive";
import { canAddHabit, dailyReflection, reflectionQuestion, WEATHERS, WEATHER_NAMES } from "../game";
import { dayKey } from "../time";
import { fail, optionalText, run, text, type ActionResult } from "./run";

const weatherInput = z.object({ weather: z.enum(WEATHERS) });

export async function setWeather(input: z.input<typeof weatherInput>): Promise<ActionResult> {
  return run(weatherInput, input, (data, db, now) => {
    const day = dayKey(now, timezone(db));
    db.weather = db.weather.filter((w) => w.day !== day);
    db.weather.push({ day, weather: data.weather });
    return { ok: true, message: `Weather logged: ${WEATHER_NAMES[data.weather]}` };
  });
}

const habitInput = z.object({ name: text(80, "Name the habit."), kind: z.enum(["keep", "starve"]) });

export async function createHabit(input: z.input<typeof habitInput>): Promise<ActionResult> {
  return run(habitInput, input, (data, db, now) => {
    if (!isUnlocked(db, "habits")) return fail("Habits open soon.");
    const active = db.habits.filter((h) => !h.archivedAt);
    const slot = canAddHabit(data.kind, active, db.reviews.length);
    if (!slot.ok) return fail(slot.reason);
    db.habits.push({ id: crypto.randomUUID(), name: data.name, kind: data.kind, archivedAt: null, createdAt: now.toISOString() });
    return { ok: true, message: data.kind === "keep" ? "Habit added. Small things, done daily." : "Habit added. Starve it gently." };
  });
}

const idInput = z.object({ id: z.string().min(1) });

export async function toggleHabit(input: z.input<typeof idInput>): Promise<ActionResult> {
  return run(idInput, input, (data, db, now) => {
    const habit = db.habits.find((h) => h.id === data.id && !h.archivedAt);
    if (!habit) return fail("That habit could not be found.");
    const day = dayKey(now, timezone(db));
    const had = db.habitLogs.some((l) => l.habitId === habit.id && l.day === day);
    db.habitLogs = db.habitLogs.filter((l) => !(l.habitId === habit.id && l.day === day));
    if (!had) db.habitLogs.push({ habitId: habit.id, day });
    return { ok: true, message: !had && habit.kind === "starve" ? "Logged. Tomorrow is a clean page." : undefined };
  });
}

export async function archiveHabit(input: z.input<typeof idInput>): Promise<ActionResult> {
  return run(idInput, input, (data, db, now) => {
    const habit = db.habits.find((h) => h.id === data.id && !h.archivedAt);
    if (!habit) return fail("That habit could not be found.");
    habit.archivedAt = now.toISOString();
    return { ok: true, message: "Habit put away. Its slot is free." };
  });
}

const journalInput = z.object({
  body: text(8000, "Write a few lines first."),
  prompt: optionalText(300),
  checkpointId: z.string().min(1).optional(),
});

export async function createJournalEntry(input: z.input<typeof journalInput>): Promise<ActionResult> {
  return run(journalInput, input, (data, db, now) => {
    const tz = timezone(db);
    const day = dayKey(now, tz);
    let prompt = data.prompt;
    if (data.checkpointId) {
      const { reflectionCheckpoints, trueNorth } = dailyReflection(db, day, tz);
      const checkpoint = reflectionCheckpoints.find((c) => c.id === data.checkpointId);
      if (!checkpoint) return fail("That checkpoint is no longer available for today’s reflection. Choose another or use a regular question.");
      prompt = `${checkpoint.questTitle} · ${checkpoint.title} — ${reflectionQuestion(trueNorth)}`;
    }
    db.journal.push({
      id: crypto.randomUUID(),
      day,
      prompt,
      body: data.body,
      weather: db.weather.find((w) => w.day === day)?.weather ?? null,
      createdAt: now.toISOString(),
    });
    return { ok: true, message: "Entry saved to your logbook." };
  });
}

const entryChange = z.object({
  id: z.string().min(1),
  expected: z.string(),
  body: text(8000, "Write a few lines first.").nullable(),
});

export async function changeJournalEntry(input: z.input<typeof entryChange>): Promise<ActionResult> {
  const parsed = entryChange.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { id, expected, body } = parsed.data;
  try {
    const written = await writeJournalEntry(id, expected, body);
    revalidatePath("/", "layout");
    if (!written) return fail("This entry changed. Close the editor and reopen the latest version.");
    return { ok: true, message: body === null ? "Entry deleted." : "Entry updated." };
  } catch (e) {
    if (e instanceof JournalWriteError || e instanceof SignedOutError) return fail(e.message);
    throw e;
  }
}
