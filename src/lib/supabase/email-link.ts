/** Resolve only the standard Supabase links issued for Compass's configured project. */
export function emailVerificationUrl(value: string, projectUrl: string, callback: string): URL | null {
  let link: URL;
  try {
    link = new URL(value);
  } catch {
    return null;
  }
  const verify = new URL("/auth/v1/verify", projectUrl);
  if (link.origin !== verify.origin || link.pathname !== verify.pathname || link.username || link.password || link.hash) return null;
  const token = link.searchParams.get("token");
  const type = link.searchParams.get("type");
  if (!token || !/^pkce_[a-zA-Z0-9_-]{16,256}$/.test(token) || (type !== "magiclink" && type !== "signup")) return null;
  verify.search = new URLSearchParams({ token, type, redirect_to: callback }).toString();
  return verify;
}

/** Supabase redirects with an authorization code. Read it without navigating to that URL. */
export function emailAuthorizationCode(location: string | null, callback: string): string | null {
  if (!location) return null;
  try {
    const result = new URL(location);
    const target = new URL(callback);
    if (result.origin !== target.origin || ![target.pathname, "/"].includes(result.pathname)) return null;
    const code = result.searchParams.get("code");
    return code && /^[a-zA-Z0-9_-]{16,256}$/.test(code) && !result.searchParams.has("error") ? code : null;
  } catch {
    return null;
  }
}
