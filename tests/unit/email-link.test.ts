import { expect, it } from "vitest";
import { emailAuthorizationCode, emailVerificationUrl } from "@/lib/supabase/email-link";

const project = "https://project.supabase.co";
const callback = "https://compass.example/auth/callback";
const token = "pkce_abcdef1234567890abcdef1234567890";
const code = "7733759e-bb71-4014-becc-a98e73494502";

it.each(["signup", "magiclink"])("uses only the configured project and Compass callback for a %s email", (type) => {
  const url = emailVerificationUrl(`${project}/auth/v1/verify?token=${token}&type=${type}&redirect_to=https://example.com`, project, callback);
  expect(url?.origin).toBe(project);
  expect(url?.pathname).toBe("/auth/v1/verify");
  expect(url?.searchParams.get("redirect_to")).toBe(callback);
  expect(url?.searchParams.get("token")).toBe(token);
});

it.each([
  `https://elsewhere.example/auth/v1/verify?token=${token}&type=magiclink`,
  `${project}/another-route?token=${token}&type=signup`,
  `${project}/auth/v1/verify?token=${token}&type=recovery`,
  `${project}/auth/v1/verify?token=abcdef1234567890&type=magiclink`,
])("rejects links outside Compass sign-in", (link) => {
  expect(emailVerificationUrl(link, project, callback)).toBeNull();
});

it("exchanges a code only from Compass's redirect", () => {
  expect(emailAuthorizationCode(`${callback}?code=${code}`, callback)).toBe(code);
  expect(emailAuthorizationCode(`https://compass.example/?code=${code}`, callback)).toBe(code);
  expect(emailAuthorizationCode(`${callback}?error=access_denied&code=${code}`, callback)).toBeNull();
  expect(emailAuthorizationCode(`https://elsewhere.example/?code=${code}`, callback)).toBeNull();
});
