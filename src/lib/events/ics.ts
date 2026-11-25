import type { CompassEvent } from "../db/schema";

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, "");
const escapeText = (value: string) => value.replace(/\\/g, "\\\\")
  .replace(/\r\n|\r|\n/g, "\\n").replace(/[;,]/g, "\\$&");

/** Keep each physical line within 75 UTF-8 octets without splitting a character. */
function fold(line: string): string {
  let output = "";
  let width = 0;
  for (const character of line) {
    const bytes = Buffer.byteLength(character);
    if (width + bytes > 75) {
      output += "\r\n ";
      width = 1;
    }
    output += character;
    width += bytes;
  }
  return output;
}

export function eventCalendar(events: CompassEvent[]): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Compass//Events//EN", "CALSCALE:GREGORIAN"];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@compass`,
      `DTSTAMP:${stamp(event.createdAt)}`,
      `DTSTART:${stamp(event.startsAt)}`,
      `DTEND:${stamp(event.endsAt)}`,
      `SUMMARY:${escapeText(event.title)}`,
    );
    if (event.note) lines.push(`DESCRIPTION:${escapeText(event.note)}`);
    lines.push("END:VEVENT");
  }
  return [...lines, "END:VCALENDAR", ""].map(fold).join("\r\n");
}
