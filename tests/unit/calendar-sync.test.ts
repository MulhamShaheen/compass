import { beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  readIcsFeed: vi.fn(),
  syncGoogleCalendar: vi.fn(),
  calendarStore: vi.fn(),
  listCalendarSyncJobs: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/calendar/ics", () => ({ readIcsFeed: deps.readIcsFeed }));
vi.mock("@/lib/calendar/google", () => ({ syncGoogleCalendar: deps.syncGoogleCalendar }));
vi.mock("@/lib/calendar/store", () => ({
  calendarStore: deps.calendarStore,
  listCalendarSyncJobs: deps.listCalendarSyncJobs,
}));
import { syncAllCalendars, syncCalendarSource } from "@/lib/calendar/sync";
import { GET } from "@/app/api/cron/calendar-sync/route";

const store = { readSync: vi.fn(), applySync: vi.fn() };
beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  deps.calendarStore.mockResolvedValue(store);
  store.readSync.mockResolvedValue({
    source: { kind: "ics" }, timezone: "UTC", secret: "mock-private-url", version: 2, cursor: null,
  });
  store.applySync.mockResolvedValue(true);
});

describe("calendar sync", () => {
  it("uses a complete snapshot for an ICS feed, including an empty feed", async () => {
    deps.readIcsFeed.mockResolvedValue([]);
    expect(await syncCalendarSource("one")).toBe("synced");
    expect(store.applySync).toHaveBeenCalledWith("one", 2, { events: [], cursor: null, replace: true });
  });

  it("applies Google deletions and next token in the same optimistic write", async () => {
    store.readSync.mockResolvedValue({
      source: { kind: "google" }, timezone: "Europe/Moscow", secret: "token", version: 9, cursor: "last",
    });
    deps.syncGoogleCalendar.mockResolvedValue({ events: [], removedIds: ["gone"], nextCursor: "next", full: false });
    store.applySync.mockResolvedValue(false);
    expect(await syncCalendarSource("one")).toBe("busy");
    expect(deps.syncGoogleCalendar).toHaveBeenCalledWith("token", "last", expect.any(Date), "Europe/Moscow");
    expect(store.applySync).toHaveBeenCalledWith("one", 9, {
      events: [], deleted: ["gone"], cursor: "next", replace: false,
    });
  });

  it("preserves cached data when a provider fails and keeps secrets out of the error", async () => {
    deps.readIcsFeed.mockRejectedValue(new Error("mock-private-url was unavailable"));
    await expect(syncCalendarSource("one")).rejects.toThrow(/^Could not sync this calendar/);
    expect(store.applySync).not.toHaveBeenCalled();
  });

  it("finishes other sources after one fails", async () => {
    const sourceIds = ["one", "two", "three", "four", "five", "six"];
    deps.listCalendarSyncJobs.mockResolvedValue(sourceIds.map(sourceId => ({ sourceId, store })));
    deps.readIcsFeed.mockRejectedValueOnce(new Error()).mockResolvedValue([]);
    expect(await syncAllCalendars()).toEqual({ synced: 5, failed: 1, busy: 0 });
    expect(store.readSync.mock.calls.map(([id]) => id).sort()).toEqual(sourceIds.sort());
  });

  it("requires the configured bearer token before querying any source", async () => {
    const url = "https://example.test/api/cron/calendar-sync";
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(new Request(url))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "correct");
    expect((await GET(new Request(url, { headers: { Authorization: "Bearer invalid" } }))).status).toBe(401);
    expect(deps.listCalendarSyncJobs).not.toHaveBeenCalled();
    deps.listCalendarSyncJobs.mockResolvedValue([]);
    expect((await GET(new Request(url, { headers: { Authorization: "Bearer correct" } }))).status).toBe(200);
  });
});
