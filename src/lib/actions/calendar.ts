"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalizeFeedUrl } from "@/lib/calendar/feed-url";
import { calendarStore } from "@/lib/calendar/store";
import { suggestedCheckpoints } from "@/lib/calendar/suggestions";
import { syncCalendarSource } from "@/lib/calendar/sync";
import { canConnectCalendar, timezone } from "@/lib/db/derive";
import { loadDb } from "@/lib/db/store";
import { ATTRIBUTES } from "@/lib/game";
import { formatInTimeZone } from "date-fns-tz";
import { fail, text, type ActionResult } from "./run";

const id = z.string().min(1).max(160);
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a time of day.");
const hours = z.object({ start: clock, end: clock }).refine(({ start, end }) => start !== end, "Choose different start and end times.");
const feedUrl = text(4096, "Enter the calendar's subscription URL.").transform((url, ctx) => {
  try {
    return normalizeFeedUrl(url);
  } catch {
    ctx.addIssue({ code: "custom", message: "Use a public HTTPS or webcal subscription URL." });
    return z.NEVER;
  }
});
const subscription = z.object({ name: text(80, "Give the calendar a name."), url: feedUrl });
const target = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("quest"), id }),
  z.object({ kind: z.literal("attribute"), id: z.enum(ATTRIBUTES) }),
]);
const taggingRule = z.object({ match: text(100, "Enter a word or phrase to match."), target });
const confirmation = z.object({ eventId: id, questId: id });

function ruleFields({ match, target }: z.output<typeof taggingRule>) {
  return {
    match,
    questId: target.kind === "quest" ? target.id : null,
    attribute: target.kind === "attribute" ? target.id : null,
  };
}

async function change<S extends z.ZodType>(
  schema: S, input: unknown, apply: (data: z.output<S>, store: Awaited<ReturnType<typeof calendarStore>>) => Promise<string>,
): Promise<ActionResult> {
  const result = schema.safeParse(input);
  if (!result.success) return fail(result.error.issues[0]?.message ?? "Check your entries.");
  try {
    if (!canConnectCalendar(await loadDb())) return fail("Calendar opens after your first weekly review.");
    const store = await calendarStore();
    const message = await apply(result.data, store);
    revalidatePath("/calendar");
    return { ok: true, message };
  } catch {
    return fail("The calendar change could not be saved. Refresh and try again.");
  }
}

export async function connectIcs(input: z.input<typeof subscription>): Promise<ActionResult> {
  return change(subscription, input, async ({ name, url }, store) => {
    const sourceId = await store.addSource("ics", name, url);
    try {
      await syncCalendarSource(sourceId);
      return "Calendar connected";
    } catch {
      return "Calendar saved. First sync failed. Check the subscription URL or try Sync again.";
    }
  });
}

export async function refreshCalendar(sourceId: string): Promise<ActionResult> {
  return change(id, sourceId, async (sourceId) => {
    const result = await syncCalendarSource(sourceId);
    return result === "busy" ? "A sync is already running" : "Calendar synced";
  });
}

export async function disconnectCalendar(sourceId: string): Promise<ActionResult> {
  return change(id, sourceId, async (sourceId, store) => {
    await store.removeSource(sourceId);
    return "Calendar disconnected";
  });
}

export async function saveWakingHours(input: z.input<typeof hours>): Promise<ActionResult> {
  return change(hours, input, async ({ start, end }, store) => {
    await store.setWakingHours(start, end);
    return "Waking hours saved";
  });
}

export async function addCalendarRule(input: z.input<typeof taggingRule>): Promise<ActionResult> {
  return change(taggingRule, input, async (rule, store) => {
    const { match, questId, attribute } = ruleFields(rule);
    await store.addRule(match, questId, attribute);
    return "Event rule added";
  });
}

export type RulePreview = { id: string; title: string; date: string; quests: string[] };

export async function previewCalendarRule(input: z.input<typeof taggingRule>): Promise<
  { ok: true; matches: RulePreview[] } | Extract<ActionResult, { ok: false }>
> {
  const parsed = taggingRule.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    const db = await loadDb();
    if (!canConnectCalendar(db)) return { ok: false, error: "Calendar opens after your first weekly review." };
    const calendar = await (await calendarStore()).load();
    const hidden = new Set([...calendar.confirmedIds, ...(calendar.dismissedIds ?? [])]);
    const rule = { id: "preview", ...ruleFields(parsed.data) };
    const matches = suggestedCheckpoints(calendar.events, [rule], db.quests, new Date(), hidden)
      .slice(0, 3)
      .map(({ event, matches }) => ({
        id: event.id, title: event.title,
        date: formatInTimeZone(event.start, timezone(db), "d MMM, HH:mm"),
        quests: matches.map(({ quest }) => quest.title),
      }));
    return { ok: true, matches };
  } catch {
    return { ok: false, error: "The rule preview could not be loaded. Try again." };
  }
}

export async function removeCalendarRule(ruleId: string): Promise<ActionResult> {
  return change(id, ruleId, async (ruleId, store) => {
    await store.removeRule(ruleId);
    return "Event rule removed";
  });
}

export async function confirmSuggestion(input: z.input<typeof confirmation>): Promise<ActionResult> {
  return change(confirmation, input, async ({ eventId, questId }, store) => {
    await store.confirmEvent(eventId, questId);
    revalidatePath("/", "layout");
    return "Checkpoint logged";
  });
}

export async function dismissSuggestion(eventId: string): Promise<ActionResult> {
  return change(id, eventId, async (id, store) => {
    await store.dismissEvent(id);
    return "Suggestion dismissed";
  });
}
