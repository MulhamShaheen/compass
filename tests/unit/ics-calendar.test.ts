import { describe, expect, it } from "vitest";
import { normalizeFeedUrl } from "@/lib/calendar/feed-url";
import { parseIcsFeed } from "@/lib/calendar/ics";

const now = new Date("2026-11-03T12:00:00Z");

function feed(events: string) {
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Compass//Calendar tests//EN
${events}
END:VCALENDAR`;
}

describe("ICS import", () => {
  it("expands weekly events in their time zone through DST and keeps moved occurrences stable", () => {
    const series = `BEGIN:VEVENT
UID:weekly-practice
DTSTART;TZID=America/New_York:20261025T100000
DTEND;TZID=America/New_York:20261025T110000
RRULE:FREQ=WEEKLY;COUNT=4
EXDATE;TZID=America/New_York:20261108T100000
SUMMARY:Piano practice
END:VEVENT`;
    const override = `BEGIN:VEVENT
UID:weekly-practice
RECURRENCE-ID;TZID=America/New_York:20261101T100000
DTSTART;TZID=America/New_York:20261102T150000
DTEND;TZID=America/New_York:20261102T160000
SUMMARY:Piano rehearsal
END:VEVENT`;
    const original = parseIcsFeed(feed(series), now, "UTC");
    const changed = parseIcsFeed(feed(series + "\n" + override), now, "UTC").sort((a, b) => a.start.localeCompare(b.start));

    expect(changed.map(({ title, start }) => [title, start])).toEqual([
      ["Piano practice", "2026-10-25T14:00:00.000Z"],
      ["Piano rehearsal", "2026-11-02T20:00:00.000Z"],
      ["Piano practice", "2026-11-15T15:00:00.000Z"],
    ]);
    expect(changed[1].externalId).toBe(original.find(({ start }) => start === "2026-11-01T15:00:00.000Z")?.externalId);
  });

  it("uses local boundaries for all-day events and excludes transparent events", () => {
    expect(parseIcsFeed(feed(`BEGIN:VEVENT
UID:holiday
DTSTART;VALUE=DATE:20261101
DTEND;VALUE=DATE:20261102
SUMMARY:Holiday
END:VEVENT
BEGIN:VEVENT
UID:reminder
DTSTART:20261101T100000Z
DTEND:20261101T110000Z
TRANSP:TRANSPARENT
SUMMARY:Reminder
END:VEVENT`), now, "America/New_York")).toMatchObject([
      { title: "Holiday", start: "2026-11-01T04:00:00.000Z", end: "2026-11-02T05:00:00.000Z" },
    ]);
  });

  it("uses the profile timezone for floating times when no calendar zone is set", () => {
    const [event] = parseIcsFeed(feed(`BEGIN:VEVENT
UID:floating
DTSTART:20261103T100000
DTEND:20261103T110000
SUMMARY:Coffee
END:VEVENT`), now, "Europe/Moscow");
    expect(event.start).toBe("2026-11-03T07:00:00.000Z");
    expect(event.end).toBe("2026-11-03T08:00:00.000Z");
  });

  it("accepts a webcal subscription as HTTPS and rejects local or credentialed URLs", () => {
    expect(normalizeFeedUrl("webcal://calendar.example/feed.ics#x")).toBe("https://calendar.example/feed.ics");
    for (const url of ["https://127.0.0.1/feed", "https://[::1]/feed", "https://calendar.local/feed", "https://user:pass@calendar.example/feed", "http://calendar.example/feed"]) {
      expect(() => normalizeFeedUrl(url)).toThrow();
    }
  });
});
