import { createHash } from "node:crypto";
import type { CalendarEvent, CalendarInputEvent } from "./types";

// The same occurrence keeps its identity across full refreshes, even if a
// cancellation or a sliding sync window temporarily removes the event.
export function storedEvent(sourceId: string, event: CalendarInputEvent): CalendarEvent {
  const hex = createHash("sha256").update(sourceId + "\0" + event.externalId).digest("hex");
  const id = [hex.slice(0, 8), hex.slice(8, 12), "8" + hex.slice(13, 16),
    "a" + hex.slice(17, 20), hex.slice(20, 32)].join("-");
  return { id, sourceId, ...event };
}
