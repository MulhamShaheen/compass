import { NextResponse, type NextRequest } from "next/server";
import { canConnectCalendar } from "@/lib/db/derive";
import { loadDb } from "@/lib/db/store";
import {
  googleCallbackPath,
  googleCookie,
  startGoogleAuthorization,
} from "@/lib/calendar/google";
import { isLocalMode } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  if (isLocalMode())
    return NextResponse.redirect(
      new URL("/calendar?google=unavailable", origin),
    );
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));
  if (!canConnectCalendar(await loadDb()))
    return NextResponse.redirect(new URL("/calendar", origin));

  try {
    const { url, verifier } = startGoogleAuthorization(origin, user.id);
    const response = NextResponse.redirect(url);
    response.headers.set("Cache-Control", "no-store");
    response.cookies.set(googleCookie, verifier, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: googleCallbackPath,
      maxAge: 600,
    });
    return response;
  } catch {
    return NextResponse.redirect(
      new URL("/calendar?google=unavailable", origin),
    );
  }
}
