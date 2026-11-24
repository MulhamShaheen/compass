import { NextResponse, type NextRequest } from "next/server";
import { canConnectCalendar } from "@/lib/db/derive";
import { loadDb } from "@/lib/db/store";
import {
  exchangeGoogleCode,
  googleCallbackPath,
  googleCookie,
  validGoogleState,
} from "@/lib/calendar/google";
import { calendarStore } from "@/lib/calendar/store";
import { syncCalendarSource } from "@/lib/calendar/sync";
import { isLocalMode } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  function finish(path: string) {
    const response = NextResponse.redirect(new URL(path, origin));
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.cookies.set(googleCookie, "", {
      path: googleCallbackPath,
      maxAge: 0,
    });
    return response;
  }

  if (isLocalMode()) return finish("/calendar?google=unavailable");
  const user = await currentUser();
  if (!user) return finish("/login");
  const verifier = request.cookies.get(googleCookie)?.value ?? "";
  if (!validGoogleState(verifier, user.id, searchParams.get("state") ?? ""))
    return finish("/calendar?google=failed");
  if (searchParams.get("error") === "access_denied")
    return finish("/calendar?google=denied");
  const code = searchParams.get("code");
  if (!code) return finish("/calendar?google=failed");
  if (!canConnectCalendar(await loadDb())) return finish("/calendar");

  let sourceId: string;
  try {
    const refreshToken = await exchangeGoogleCode(code, verifier, origin);
    const store = await calendarStore();
    sourceId = await store.addSource(
      "google",
      "Google primary calendar",
      refreshToken,
    );
  } catch {
    return finish("/calendar?google=failed");
  }
  try {
    await syncCalendarSource(sourceId);
    return finish("/calendar?google=connected");
  } catch {
    return finish("/calendar?google=pending");
  }
}
