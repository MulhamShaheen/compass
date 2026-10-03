"use server";

import { z } from "zod";
import { currentLevel, isUnlocked, timezone } from "../db/derive";
import { ATTRIBUTES, canActivateQuest, checkpointPoints, splitByAttributes, ATTRIBUTE_NAMES } from "../game";
import { dayKey, localInputToDate } from "../time";
import { fail, optionalText, run, text, type ActionResult } from "./run";

const attribute = z.enum(ATTRIBUTES);

const questInput = z.object({
  title: text(120, "Give the quest a name."),
  why: optionalText(400),
  type: z.enum(["main", "side"]),
  primaryAttr: attribute,
  secondaryAttr: attribute.nullable().optional(),
});

export async function createQuest(input: z.input<typeof questInput>): Promise<ActionResult> {
  return run(questInput, input, (data, db, now) => {
    if (data.type === "side" && !isUnlocked(db, "side_quests")) {
      return fail("Side quests open soon. For now, follow your main quest.");
    }
    const slot = canActivateQuest(data.type, db.quests, currentLevel(db));
    if (!slot.ok) return fail(slot.reason);
    const tz = timezone(db);
    const id = crypto.randomUUID();
    db.quests.push({
      id,
      chapterId: db.chapters.find((c) => !c.endedOn)?.id ?? null,
      type: data.type,
      status: "active",
      title: data.title,
      why: data.why,
      primaryAttr: data.primaryAttr,
      secondaryAttr: data.secondaryAttr && data.secondaryAttr !== data.primaryAttr ? data.secondaryAttr : null,
      startedOn: dayKey(now, tz),
      completedAt: null,
      createdAt: now.toISOString(),
    });
    return { ok: true, id, message: "Quest begun. Log the first checkpoint." };
  });
}

const statusInput = z.object({ questId: z.string().min(1), status: z.enum(["active", "paused", "done"]) });

export async function setQuestStatus(input: z.input<typeof statusInput>): Promise<ActionResult> {
  return run(statusInput, input, (data, db, now) => {
    const quest = db.quests.find((q) => q.id === data.questId);
    if (!quest || quest.type === "system") return fail("That quest could not be found.");
    if (data.status === "active" && quest.status !== "active") {
      const slot = canActivateQuest(quest.type, db.quests, currentLevel(db), { excludeId: quest.id });
      if (!slot.ok) return fail(slot.reason);
    }
    quest.status = data.status;
    quest.completedAt = data.status === "done" ? now.toISOString() : null;
    const message =
      data.status === "done" ? "Quest completed. A chapter of its own." : data.status === "paused" ? "Quest paused. Its slot is free." : "Quest resumed";
    return { ok: true, message };
  });
}

const checkpointInput = z.object({
  questId: z.string().min(1),
  title: text(160, "Say what happened in a few words."),
  note: optionalText(4000),
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time."),
  minutes: z.number().int().min(0).max(1440),
  isMilestone: z.boolean(),
});

export async function createCheckpoint(input: z.input<typeof checkpointInput>): Promise<ActionResult> {
  return run(checkpointInput, input, (data, db, now) => {
    const quest = db.quests.find((q) => q.id === data.questId);
    if (!quest || quest.type === "system") return fail("That quest could not be found.");
    if (quest.status === "done") return fail("This quest is complete. Reopen it to add to the story.");
    const id = crypto.randomUUID();
    db.checkpoints.push({
      id,
      questId: quest.id,
      occurredAt: localInputToDate(data.occurredAt, timezone(db)).toISOString(),
      title: data.title,
      note: data.note,
      minutes: data.minutes,
      isMilestone: data.isMilestone,
      source: "manual",
      createdAt: now.toISOString(),
    });
    let resumed = "";
    if (quest.status === "paused" && canActivateQuest(quest.type, db.quests, currentLevel(db), { excludeId: quest.id }).ok) {
      quest.status = "active";
      resumed = " Quest resumed.";
    }
    const gain = splitByAttributes(quest, checkpointPoints(data))
      .map(([a, v]) => `+${Math.round(v)} ${ATTRIBUTE_NAMES[a]}`)
      .join(", ");
    return { ok: true, id, message: `Checkpoint logged · ${gain}.${resumed}` };
  });
}

const updateCheckpointInput = checkpointInput.omit({ questId: true }).extend({ id: z.string().min(1) });

export async function updateCheckpoint(input: z.input<typeof updateCheckpointInput>): Promise<ActionResult> {
  return run(updateCheckpointInput, input, (data, db) => {
    const cp = db.checkpoints.find((c) => c.id === data.id);
    const quest = cp && db.quests.find((q) => q.id === cp.questId);
    if (!cp || !quest || quest.type === "system") return fail("That checkpoint could not be found.");
    cp.title = data.title;
    cp.note = data.note;
    cp.occurredAt = localInputToDate(data.occurredAt, timezone(db)).toISOString();
    cp.minutes = data.minutes;
    cp.isMilestone = data.isMilestone;
    return { ok: true, message: "Checkpoint updated" };
  });
}

const idInput = z.object({ id: z.string().min(1) });

export async function deleteCheckpoint(input: z.input<typeof idInput>): Promise<ActionResult> {
  return run(idInput, input, (data, db) => {
    const cp = db.checkpoints.find((c) => c.id === data.id);
    const quest = cp && db.quests.find((q) => q.id === cp.questId);
    if (!cp || !quest || quest.type === "system") return fail("That checkpoint could not be found.");
    db.checkpoints = db.checkpoints.filter((c) => c.id !== data.id);
    return { ok: true, message: "Checkpoint removed. Points recalculated." };
  });
}

const editQuestInput = z.object({
  id: z.string().min(1),
  title: text(120, "Give the quest a name."),
  why: optionalText(400),
});

export async function updateQuest(input: z.input<typeof editQuestInput>): Promise<ActionResult> {
  return run(editQuestInput, input, (data, db) => {
    const quest = db.quests.find((q) => q.id === data.id);
    if (!quest || quest.type === "system") return fail("That quest could not be found.");
    quest.title = data.title;
    quest.why = data.why;
    return { ok: true, message: "Quest updated" };
  });
}
