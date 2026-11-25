/**
 * Where data lives.
 * - Default: Supabase, per signed-in user, protected by Row Level Security.
 * - COMPASS_STORE=local: a single-character JSON file and no sign-in. Only for
 *   the Playwright tests and offline tinkering; it cannot work on Vercel.
 */
export function isLocalMode(): boolean {
  return process.env.COMPASS_STORE === "local";
}

/** Compass reads auth cookies on the server. Supabase SSR sets their persistent lifetime. */
export const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
} as const;

export function supabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or COMPASS_STORE=local for the local file store).",
    );
  }
  return { url, key };
}
