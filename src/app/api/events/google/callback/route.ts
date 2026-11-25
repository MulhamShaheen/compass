import { NextResponse, type NextRequest } from "next/server";
import { exchangeGoogleCode, validGoogleState } from "@/lib/calendar/google";
import {
  createGoogleEventsCalendar, deleteUnusedGoogleCalendar, googleWriteAccessToken,
  googleWriteCallback, googleWriteCookie, googleWriteScope,
} from "@/lib/events/google";
import { googlePublishingConfigured, readGooglePublishing, saveGooglePublishing } from "@/lib/events/google-store";
import { currentUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  function finish(path: string) {
    const response = NextResponse.redirect(new URL(path, origin));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.cookies.set(googleWriteCookie, "", { path: googleWriteCallback, maxAge: 0 });
    return response;
  }
  if (!googlePublishingConfigured()) return finish("/events?google=unavailable");
  const user = await currentUser();
  if (!user) return finish("/login");
  const verifier = request.cookies.get(googleWriteCookie)?.value ?? "";
  if (!validGoogleState(verifier, user.id, searchParams.get("state") ?? "", googleWriteCallback)) return finish("/events?google=failed");
  if (searchParams.get("error") === "access_denied") return finish("/events?google=denied");
  const code = searchParams.get("code");
  if (!code) return finish("/events?google=failed");

  try {
    const status = await readGooglePublishing(user.id);
    if (!status) return finish("/events?google=unavailable");
    if (status.connected) return finish("/events?google=connected");
    const refreshToken = await exchangeGoogleCode(code, verifier, origin, googleWriteCallback, googleWriteScope);
    const accessToken = await googleWriteAccessToken(refreshToken);
    const calendar = await createGoogleEventsCalendar(accessToken);
    if (!(await saveGooglePublishing(user.id, calendar, refreshToken))) {
      // A second authorized callback already stored a different calendar.
      await deleteUnusedGoogleCalendar(accessToken, calendar).catch(() => undefined);
    }
    return finish("/events?google=connected");
  } catch {
    return finish("/events?google=failed");
  }
}
