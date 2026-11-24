import "server-only";
import { syncGoogleCalendar } from "./google";
import { readIcsFeed } from "./ics";
import { calendarStore, listCalendarSyncJobs } from "./store";

type Store = Awaited<ReturnType<typeof calendarStore>>;
type SyncResult = "synced" | "busy";

async function syncSource(store: Store, sourceId: string, now: Date): Promise<SyncResult> {
  const { source, secret, cursor, version, timezone } = await store.readSync(sourceId);
  if (source.kind === "ics") {
    const events = await readIcsFeed(secret, now, timezone);
    const applied = await store.applySync(sourceId, version, { events, replace: true, cursor: null });
    return applied ? "synced" : "busy";
  }

  const result = await syncGoogleCalendar(secret, cursor, now, timezone);
  const applied = await store.applySync(sourceId, version, {
    events: result.events,
    deleted: result.removedIds,
    cursor: result.nextCursor,
    replace: result.full,
  });
  return applied ? "synced" : "busy";
}

/** Server actions get the owner from the session inside calendarStore. */
export async function syncCalendarSource(sourceId: string): Promise<SyncResult> {
  try {
    return await syncSource(await calendarStore(), sourceId, new Date());
  } catch {
    // The upstream error can contain the private feed URL or information about an event.
    throw new Error("Could not sync this calendar. Check the connection and try again.");
  }
}

/** Workers share an iterator so a slow or unreachable provider won't block the other sources. */
export async function syncAllCalendars() {
  const jobs = await listCalendarSyncJobs();
  const pending = jobs.values();
  const now = new Date();
  const totals = { synced: 0, busy: 0, failed: 0 };

  async function worker() {
    for (const { store, sourceId } of pending) {
      try {
        const outcome = await syncSource(store, sourceId, now);
        totals[outcome]++;
      } catch {
        totals.failed++;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, worker));
  return totals;
}
