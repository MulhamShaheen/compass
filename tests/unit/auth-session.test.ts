import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const { fakeClient } = vi.hoisted(() => ({ fakeClient: vi.fn() }));
vi.mock("@supabase/ssr", () => ({ createServerClient: fakeClient }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

it("returns refreshed persistent cookies when sending a signed-in user away from login", async () => {
  vi.stubEnv("COMPASS_STORE", "");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fixture.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "fixture-key");
  fakeClient.mockImplementation((_url, _key, { cookies, cookieOptions }) => ({
    auth: {
      async getClaims() {
        cookies.setAll([{ name: "sb-fixture-auth-token", value: "refreshed", options: { ...cookieOptions, path: "/", maxAge: 3600 } }]);
        return { data: { claims: { sub: "user" } } };
      },
    },
  }));

  const response = await proxy(new NextRequest("https://compass.example/login"));
  expect(response.headers.get("location")).toBe("https://compass.example/");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.cookies.get("sb-fixture-auth-token")).toMatchObject({
    value: "refreshed", path: "/", maxAge: 3600, httpOnly: true,
  });
});
