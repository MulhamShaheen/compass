import { afterEach, expect, it, vi } from "vitest";
import { startGoogleAuthorization, validGoogleState } from "@/lib/calendar/google";
import { googleWriteCallback, googleWriteScope, publishGoogleEvent, removeGoogleEvent } from "@/lib/events/google";
import type { CompassEvent } from "@/lib/db/schema";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const event = {
  title: "Lunch break", note: "Meet at the café",
  startsAt: "2026-11-25T10:00:00.000Z", endsAt: "2026-11-25T10:30:00.000Z",
} as CompassEvent;
const remoteId = "62e6e21f6d8149c295ae45b271e93032";

it("requests the narrow write scope and binds state to the callback and user", () => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "fixture-client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "fixture-secret");
  const { url, verifier } = startGoogleAuthorization("https://compass.example", "alice", googleWriteCallback, googleWriteScope);
  const state = url.searchParams.get("state")!;
  expect(url.searchParams.get("scope")).toBe(googleWriteScope);
  expect(url.searchParams.get("redirect_uri")).toBe("https://compass.example/api/events/google/callback");
  expect(validGoogleState(verifier, "alice", state, googleWriteCallback)).toBe(true);
  expect(validGoogleState(verifier, "bob", state, googleWriteCallback)).toBe(false);
  expect(validGoogleState(verifier, "alice", state)).toBe(false);
});

it("creates and updates one Google event, including a conflict after an uncertain write", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>();
  for (const status of [404, 409, 200, 200]) fetch.mockResolvedValueOnce(new Response(null, { status }));
  vi.stubGlobal("fetch", fetch);
  await publishGoogleEvent("access", "calendar@google.com", remoteId, event);
  await publishGoogleEvent("access", "calendar@google.com", remoteId, { ...event, title: "New title" });
  expect(fetch.mock.calls.map(([, init]) => init?.method)).toEqual(["PUT", "POST", "PUT", "PUT"]);
  expect(fetch.mock.calls[0][0]).toBe(fetch.mock.calls[3][0]);
  expect(JSON.parse(String(fetch.mock.calls[1][1]?.body))).toMatchObject({ id: remoteId, summary: event.title });
  expect(JSON.parse(String(fetch.mock.calls[3][1]?.body))).toMatchObject({ id: remoteId, summary: "New title" });
});

it("treats a previously removed Google event as a successful retry", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 410 }));
  vi.stubGlobal("fetch", fetch);
  await removeGoogleEvent("access", "calendar@google.com", remoteId);
  expect(fetch.mock.calls[0][1]?.method).toBe("DELETE");
});
