import { createHash } from "node:crypto";
import { fromZonedTime } from "date-fns-tz";
import { expandRecurringEvent, sync } from "node-ical";
import type { CalendarInputEvent } from "./types";
import { downloadFeed, maxFeedBytes } from "./feed-url";

const day = 86_400_000;
const occurrenceLimit = 5000;

function resolveFloatingTimes(lines: string, timezone: string) {
  // A floating date-time uses the calendar's default zone, then the user's zone.
  const hint = /^X-WR-TIMEZONE:([^\n]+)$/im.exec(lines)?.[1].trim();
  let zone = timezone;
  if (hint) {
    try {
      zone = new Intl.DateTimeFormat("en", { timeZone: hint }).resolvedOptions().timeZone;
    } catch { /* Use the profile zone for non-IANA calendar hints. */ }
  }
  zone = new Intl.DateTimeFormat("en", { timeZone: zone }).resolvedOptions().timeZone;
  return lines.replace(/^BEGIN:VEVENT\n[\s\S]*?^END:VEVENT$/gim, (event) =>
    event.replace(/^(DTSTART|DTEND|RECURRENCE-ID|EXDATE)((?:;[^:\n]+)?):((?:\d{8}T\d{6},?)+)$/gim,
      (line, name, parameters, value) =>
        /;TZID=/i.test(parameters) ? line : `${name}${parameters};TZID=${zone}:${value}`));
}

export function parseIcsFeed(body: string, now: Date, timezone: string): CalendarInputEvent[] {
  if (Buffer.byteLength(body) > maxFeedBytes) throw new Error("Calendar feed exceeds the size limit.");
  const lines = body.trim().replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "");
  if (!/^BEGIN:VCALENDAR\n/i.test(lines) || !/\nEND:VCALENDAR$/i.test(lines)) {
    throw new Error("The subscription did not return an iCalendar feed.");
  }
  const calendar = sync.parseICS(resolveFloatingTimes(lines, timezone));
  const earliest = now.getTime() - 35 * day;
  const latest = now.getTime() + 30 * day;
  const events: CalendarInputEvent[] = [];
  for (const event of Object.values(calendar)) {
    if (event?.type !== "VEVENT" || !event.uid || !event.start || event.status === "CANCELLED") continue;
    // Include a day at each edge before converting floating, all-day dates into user instants.
    const instances = expandRecurringEvent(event, {
      from: new Date(earliest - day), to: new Date(latest + day),
      expandOngoing: true, maxIterations: occurrenceLimit,
    });
    for (const instance of instances) {
      if (instance.event.status === "CANCELLED" || (instance.event.transparency ?? event.transparency) === "TRANSPARENT") continue;
      const start = instance.isFullDay ? fromZonedTime(instance.start, timezone) : instance.start;
      const end = instance.isFullDay ? fromZonedTime(instance.end, timezone) : instance.end;
      if (end <= start || end.getTime() <= earliest || start.getTime() >= latest) continue;
      const original = instance.event.recurrenceid ?? instance.start;
      const occurrence = instance.isRecurring || instance.event.recurrenceid ? original.toISOString() : "";
      const externalId = createHash("sha256").update(JSON.stringify([event.uid, occurrence])).digest("hex");
      const summary = typeof instance.summary === "string" ? instance.summary : instance.summary?.val;
      events.push({ externalId, title: summary?.trim().slice(0, 512) || "Calendar event", start: start.toISOString(), end: end.toISOString() });
      if (events.length > occurrenceLimit) throw new Error("Calendar feed has too many occurrences.");
    }
  }
  return events;
}

export async function readIcsFeed(url: string, now: Date, timezone: string) {
  try {
    return parseIcsFeed(await downloadFeed(url), now, timezone);
  } catch {
    // Subscription URLs often contain bearer tokens. Never surface provider or socket errors.
    throw new Error("Could not sync the calendar. Check its subscription link and try again.");
  }
}
