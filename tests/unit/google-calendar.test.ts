import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  exchangeGoogleCode,
  startGoogleAuthorization,
  syncGoogleCalendar,
  validGoogleState,
} from "@/lib/calendar/google";

const transport = vi.fn<typeof fetch>();
const now = new Date("2026-11-01T14:00:00Z");
const zone = "America/New_York";
const busy = {
  id: "occurrence",
  summary: "Long Sunday",
  start: { date: "2026-11-01" },
  end: { date: "2026-11-02" },
};
const cursor = JSON.stringify({
  day: "2026-11-01",
  timezone: zone,
  token: "before",
});

function reply(body: unknown, status = 200) {
  transport.mockResolvedValueOnce(Response.json(body, { status }));
}

function paramsAt(call: number) {
  return new URL(String(transport.mock.calls[call][0])).searchParams;
}

beforeEach(() => {
  vi.stubGlobal("fetch", transport);
  vi.stubEnv("GOOGLE_CLIENT_ID", "test-client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-secret");
});
afterEach(() => {
  transport.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Google Calendar consent", () => {
  it("requests only read-only calendar access and binds the PKCE flow to the same browser and Compass account", () => {
    const auth = startGoogleAuthorization("https://compass.example", "person");
    const params = auth.url.searchParams;
    const state = params.get("state")!;
    expect(params.get("redirect_uri")).toBe(
      "https://compass.example/api/calendar/google/callback",
    );
    expect(params.get("scope")).toBe(
      "https://www.googleapis.com/auth/calendar.readonly",
    );
    expect(params.get("code_challenge_method")).toBe("S256");
    expect(params.get("access_type")).toBe("offline");
    expect(auth.url.href).not.toContain(auth.verifier);
    expect(validGoogleState(auth.verifier, "person", state)).toBe(true);
    expect(validGoogleState(auth.verifier, "other", state)).toBe(false);
    expect(
      validGoogleState(
        startGoogleAuthorization("https://compass.example", "person").verifier,
        "person",
        state,
      ),
    ).toBe(false);
    expect(validGoogleState(auth.verifier, "person", "")).toBe(false);
  });

  it("exchanges the code with the verifier and requires offline access in the approved scope", async () => {
    reply({
      access_token: "access",
      refresh_token: "refresh",
      scope: "https://www.googleapis.com/auth/calendar.readonly",
    });
    expect(
      await exchangeGoogleCode("code", "verifier", "https://compass.example"),
    ).toBe("refresh");
    const body = transport.mock.calls[0][1]?.body as URLSearchParams;
    expect(body.get("code_verifier")).toBe("verifier");
    expect(body.get("redirect_uri")).toBe(
      "https://compass.example/api/calendar/google/callback",
    );
    reply({
      access_token: "access",
      scope: "https://www.googleapis.com/auth/calendar.readonly",
    });
    await expect(
      exchangeGoogleCode("code", "verifier", "https://compass.example"),
    ).rejects.toThrow("offline");
  });
});

describe("Google Calendar sync", () => {
  beforeEach(() => reply({ access_token: "access" }));

  it("requests bounded, expanded instances, follows pagination and preserves all-day boundaries over DST", async () => {
    reply({ timeZone: zone, items: [busy], nextPageToken: "next" });
    reply({ items: [], nextSyncToken: "done" });
    const result = await syncGoogleCalendar("refresh", null, now, zone);
    expect(paramsAt(1).get("timeMin")).toBe("2026-09-27T04:00:00.000Z");
    expect(paramsAt(1).get("singleEvents")).toBe("true");
    expect(paramsAt(1).has("timeMax")).toBe(true);
    expect(paramsAt(2).get("pageToken")).toBe("next");
    expect(result.full).toBe(true);
    expect(result.events).toEqual([
      {
        externalId: "occurrence",
        title: "Long Sunday",
        start: "2026-11-01T04:00:00.000Z",
        end: "2026-11-02T05:00:00.000Z",
      },
    ]);
    expect(JSON.parse(result.nextCursor).token).toBe("done");
  });

  it("removes cancelled, declined, moved and transparent occurrences on incremental updates", async () => {
    reply({
      items: [
        { id: "cancelled", status: "cancelled" },
        { id: "free", transparency: "transparent" },
        {
          id: "declined",
          attendees: [{ self: true, responseStatus: "declined" }],
        },
        {
          ...busy,
          id: "moved",
          start: { date: "2028-01-01" },
          end: { date: "2028-01-02" },
        },
      ],
      nextSyncToken: "done",
    });
    const result = await syncGoogleCalendar("refresh", cursor, now, zone);
    expect(paramsAt(1).get("syncToken")).toBe("before");
    expect(paramsAt(1).has("timeMin")).toBe(false);
    expect(result.full).toBe(false);
    expect(result.removedIds).toEqual([
      "cancelled",
      "free",
      "declined",
      "moved",
    ]);
  });

  it("starts a fresh snapshot when Google invalidates a cursor including later pages", async () => {
    reply({
      items: [{ id: "stale", status: "cancelled" }],
      nextPageToken: "more",
    });
    reply({}, 410);
    reply({ items: [], nextSyncToken: "fresh" });
    const result = await syncGoogleCalendar("refresh", cursor, now, zone);
    expect(result.full).toBe(true);
    expect(result.removedIds).toEqual([]);
    expect(paramsAt(3).has("syncToken")).toBe(false);
  });

  it("refreshes the rolling window on a new local day", async () => {
    reply({ items: [], nextSyncToken: "fresh" });
    const result = await syncGoogleCalendar(
      "refresh",
      cursor,
      new Date("2026-11-02T08:00:00Z"),
      zone,
    );
    expect(result.full).toBe(true);
    expect(paramsAt(1).get("timeMax")).toBe("2026-12-03T05:00:00.000Z");
  });

  it("fails the batch if a page cannot be fetched", async () => {
    reply({ items: [busy], nextPageToken: "more" });
    reply({}, 503);
    await expect(
      syncGoogleCalendar("refresh", cursor, now, zone),
    ).rejects.toThrow("read Google");
  });
});
