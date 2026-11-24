import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { googleCookie, startGoogleAuthorization } from "@/lib/calendar/google";
import { GET as start } from "@/app/api/calendar/google/start/route";
import { GET as callback } from "@/app/api/calendar/google/callback/route";

const mock = vi.hoisted(() => ({
  local: vi.fn(),
  user: vi.fn(),
  unlocked: vi.fn(),
  loadDb: vi.fn(),
  addSource: vi.fn(),
  sync: vi.fn(),
}));
vi.mock("@/lib/supabase/env", () => ({ isLocalMode: mock.local }));
vi.mock("@/lib/supabase/server", () => ({ currentUser: mock.user }));
vi.mock("@/lib/db/derive", () => ({ canConnectCalendar: mock.unlocked }));
vi.mock("@/lib/db/store", () => ({ loadDb: mock.loadDb }));
vi.mock("@/lib/calendar/store", () => ({
  calendarStore: async () => ({ addSource: mock.addSource }),
}));
vi.mock("@/lib/calendar/sync", () => ({ syncCalendarSource: mock.sync }));

const origin = "https://compass.example";
function callbackRequest(params: Record<string, string> = {}) {
  const auth = startGoogleAuthorization(origin, "owner");
  const search = new URLSearchParams({
    state: auth.url.searchParams.get("state")!,
    code: "code",
    ...params,
  });
  return new NextRequest(`${origin}/api/calendar/google/callback?${search}`, {
    headers: { Cookie: `${googleCookie}=${auth.verifier}` },
  });
}

beforeEach(() => {
  vi.stubEnv("GOOGLE_CLIENT_ID", "test");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "test");
  mock.local.mockReturnValue(false);
  mock.user.mockResolvedValue({ id: "owner" });
  mock.unlocked.mockReturnValue(true);
  mock.addSource.mockResolvedValue("source-id");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        access_token: "access",
        refresh_token: "refresh",
        scope: "https://www.googleapis.com/auth/calendar.readonly",
      }),
    ),
  );
});
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Google Calendar routes", () => {
  const authorize = () =>
    start(new NextRequest(origin + "/api/calendar/google/start"));
  it("sets a short-lived, same-site HTTP-only PKCE cookie restricted to the HTTPS callback", async () => {
    const response = await authorize();
    const cookie = response.cookies.get(googleCookie);
    expect(cookie).toMatchObject({
      path: "/api/calendar/google/callback",
      sameSite: "lax",
      httpOnly: true,
      secure: true,
      maxAge: 600,
    });
    expect(new URL(response.headers.get("location")!).hostname).toBe(
      "accounts.google.com",
    );
  });

  it("enforces session and unlock before starting consent", async () => {
    mock.user.mockResolvedValueOnce(null);
    expect((await authorize()).headers.get("location")).toBe(origin + "/login");
    mock.unlocked.mockReturnValueOnce(false);
    expect((await authorize()).headers.get("location")).toBe(
      origin + "/calendar",
    );
  });

  it("fails an account swap and handles refusal without exchanging the code", async () => {
    mock.user.mockResolvedValueOnce({ id: "different" });
    expect((await callback(callbackRequest())).headers.get("location")).toBe(
      origin + "/calendar?google=failed",
    );
    const denied = await callback(callbackRequest({ error: "access_denied" }));
    expect(denied.headers.get("location")).toBe(
      origin + "/calendar?google=denied",
    );
    expect(denied.cookies.get(googleCookie)?.maxAge).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(mock.addSource).not.toHaveBeenCalled();
  });

  it("checks the unlock again before saving the grant", async () => {
    mock.unlocked.mockReturnValueOnce(false);
    expect((await callback(callbackRequest())).headers.get("location")).toBe(
      origin + "/calendar",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("stores the refresh token server-side and runs the first sync", async () => {
    const response = await callback(callbackRequest());
    expect(mock.addSource).toHaveBeenCalledWith(
      "google",
      "Google primary calendar",
      "refresh",
    );
    expect(mock.sync).toHaveBeenCalledWith("source-id");
    expect(response.headers.get("location")).toBe(
      origin + "/calendar?google=connected",
    );
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("reports a saved source whose first sync still needs a retry", async () => {
    mock.sync.mockRejectedValueOnce(new Error("temporary"));
    expect((await callback(callbackRequest())).headers.get("location")).toBe(
      origin + "/calendar?google=pending",
    );
    expect(mock.addSource).toHaveBeenCalledTimes(1);
  });
});
