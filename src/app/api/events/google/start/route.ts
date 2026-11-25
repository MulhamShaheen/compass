import { NextResponse, type NextRequest } from "next/server";
import { startGoogleAuthorization } from "@/lib/calendar/google";
import { googleWriteCallback, googleWriteCookie, googleWriteScope } from "@/lib/events/google";
import { googlePublishingConfigured, readGooglePublishing } from "@/lib/events/google-store";
import { currentUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { origin, protocol } = request.nextUrl;
  function go(path: string) {
    const response = NextResponse.redirect(new URL(path, origin));
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  if (!googlePublishingConfigured()) return go("/events?google=unavailable");
  const user = await currentUser();
  if (!user) return go("/login");

  try {
    const status = await readGooglePublishing(user.id);
    if (!status) return go("/events?google=unavailable");
    if (status.connected) return go("/events?google=connected");
    const { url, verifier } = startGoogleAuthorization(origin, user.id, googleWriteCallback, googleWriteScope);
    const response = go(url.href);
    response.cookies.set(googleWriteCookie, verifier, {
      httpOnly: true, sameSite: "lax", secure: protocol === "https:",
      path: googleWriteCallback, maxAge: 600,
    });
    return response;
  } catch {
    return go("/events?google=unavailable");
  }
}
