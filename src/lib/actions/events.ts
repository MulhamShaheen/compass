"use server";

import { z } from "zod";
import { timezone } from "../db/derive";
import type { CompassEvent, Db } from "../db/schema";
import { ATTRIBUTES } from "../game/types";
import { dateToLocalInput, localInputToDate } from "../time";
import { fail, optionalText, run, text, type ActionResult } from "./run";

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time.");
const eventInput = z.object({
  title: text(160, "Give the event a name."),
  note: optionalText(4000),
  startsAt: localDateTime,
  endsAt: localDateTime,
  questId: z.string().min(1).nullable().optional(),
  checkpointId: z.string().min(1).nullable().optional(),
  attribute: z.enum(ATTRIBUTES),
});
const eventId = z.object({ id: z.uuid(), revision: z.number().int().nonnegative() });
const updateInput = eventInput.extend(eventId.shape);
const completionInput = eventId.extend({ completed: z.boolean() });

type EventFields = Pick<CompassEvent, "title" | "note" | "startsAt" | "endsAt" | "questId" | "checkpointId" | "attribute">;

function eventFields(data: z.output<typeof eventInput>, db: Db): EventFields | { error: string } {
  const tz = timezone(db);
  const start = localInputToDate(data.startsAt, tz);
  const end = localInputToDate(data.endsAt, tz);
  if (!Number.isFinite(+start) || !Number.isFinite(+end) ||
    dateToLocalInput(start, tz) !== data.startsAt || dateToLocalInput(end, tz) !== data.endsAt) {
    return { error: "Choose a start and end time that exist in your timezone." };
  }
  if (end <= start) return { error: "End time must be after the start." };

  const checkpoint = data.checkpointId && db.checkpoints.find((item) => item.id === data.checkpointId && item.source !== "system");
  if (data.checkpointId && !checkpoint) return { error: "Choose an existing checkpoint." };
  const questId = data.questId ?? (checkpoint ? checkpoint.questId : null);
  const quest = questId && db.quests.find((item) => item.id === questId && item.type !== "system");
  if (questId && !quest) return { error: "Choose an existing quest." };
  if (checkpoint && checkpoint.questId !== questId) return { error: "Choose a checkpoint from this quest." };

  return {
    title: data.title,
    note: data.note,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    questId,
    checkpointId: checkpoint ? checkpoint.id : null,
    attribute: quest ? quest.primaryAttr : data.attribute,
  };
}

export async function createEvent(input: z.input<typeof eventInput>): Promise<ActionResult> {
  return run(eventInput, input, (data, db, now) => {
    const fields = eventFields(data, db);
    if ("error" in fields) return fail(fields.error);
    const id = crypto.randomUUID();
    db.events.push({ ...fields, id, completedAt: null, createdAt: now.toISOString(), revision: 0 });
    return { ok: true, id, message: "Event added." };
  });
}

export async function updateEvent(input: z.input<typeof updateInput>): Promise<ActionResult> {
  return run(updateInput, input, (data, db) => {
    const event = db.events.find((item) => item.id === data.id);
    if (!event) return fail("That event could not be found.");
    if (event.revision !== data.revision) return fail("This event changed. Reload to see the latest version.");
    const fields = eventFields(data, db);
    if ("error" in fields) return fail(fields.error);
    if (event.completedAt && fields.startsAt > event.completedAt) {
      return fail("Reopen this event before moving it to a time after it was completed.");
    }
    Object.assign(event, fields, { revision: event.revision + 1 });
    return { ok: true, id: event.id, message: "Event updated." };
  });
}

export async function setEventCompleted(input: z.input<typeof completionInput>): Promise<ActionResult> {
  return run(completionInput, input, (data, db, now) => {
    const event = db.events.find((item) => item.id === data.id);
    if (!event) return fail("That event could not be found.");
    if (event.revision !== data.revision) return fail("This event changed. Reload to see the latest version.");
    if (data.completed && !event.completedAt) {
      if (event.startsAt > now.toISOString()) return fail("You can complete this event after it starts.");
      event.completedAt = now.toISOString();
      event.revision++;
    } else if (!data.completed && event.completedAt) {
      event.completedAt = null;
      event.revision++;
    }
    return { ok: true, id: event.id, message: data.completed ? "Event completed." : "Event reopened." };
  });
}

export async function deleteEvent(input: z.input<typeof eventId>): Promise<ActionResult> {
  const parsed = eventId.safeParse(input);
  if (!parsed.success) return fail("That event could not be found.");
  const { hasEventPublication } = await import("../events/google-store");
  if (await hasEventPublication(parsed.data.id).catch(() => false)) {
    return fail("Remove this event from Google Calendar before deleting it.");
  }
  return run(eventId, input, (data, db) => {
    const event = db.events.find((item) => item.id === data.id);
    if (event && event.revision !== data.revision) return fail("This event changed. Reload to see the latest version.");
    db.events = db.events.filter((event) => event.id !== data.id);
    return { ok: true, id: data.id, message: "Event removed." };
  });
}
