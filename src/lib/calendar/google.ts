import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { addDays, dayKey, localInputToDate } from "@/lib/time";
import type { CalendarInputEvent } from "./types";

const GOOGLE_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_EVENTS =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export const googleCallbackPath = "/api/calendar/google/callback";
export const googleCookie = "compass_calendar_pkce";

function credentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret)
    throw new Error("Google Calendar is not configured.");
  return { clientId, clientSecret };
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function oauthState(verifier: string, userId: string, path: string): string {
  const purpose = path === googleCallbackPath ? "compass-calendar" : path;
  return digest(`${purpose}:${userId}:${verifier}`);
}

export function startGoogleAuthorization(origin: string, userId: string, callbackPath = googleCallbackPath, scope = GOOGLE_SCOPE) {
  const { clientId } = credentials();
  const verifier = randomBytes(32).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: new URL(callbackPath, origin).href,
    response_type: "code",
    scope,
    access_type: "offline",
    prompt: "consent",
    state: oauthState(verifier, userId, callbackPath),
    code_challenge: digest(verifier),
    code_challenge_method: "S256",
  }).toString();
  return { verifier, url };
}

export function validGoogleState(
  verifier: string,
  userId: string,
  state: string,
  callbackPath = googleCallbackPath,
): boolean {
  if (!/^[\w-]{43}$/.test(verifier) || !/^[\w-]{43}$/.test(state)) return false;
  return timingSafeEqual(
    Buffer.from(oauthState(verifier, userId, callbackPath)),
    Buffer.from(state),
  );
}

export async function tokenRequest(params: Record<string, string>) {
  const { clientId, clientSecret } = credentials();
  const response = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    body: new URLSearchParams({
      ...params,
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error("Google Calendar authorization failed.");
  return z
    .object({
      access_token: z.string().min(1),
      refresh_token: z.string().min(1).optional(),
      scope: z.string().optional(),
    })
    .parse(await response.json());
}

export async function exchangeGoogleCode(
  code: string,
  verifier: string,
  origin: string,
  callbackPath = googleCallbackPath,
  scope = GOOGLE_SCOPE,
): Promise<string> {
  const token = await tokenRequest({
    grant_type: "authorization_code",
    code,
    code_verifier: verifier,
    redirect_uri: new URL(callbackPath, origin).href,
  });
  if (!token.refresh_token || !token.scope?.split(" ").includes(scope)) {
    throw new Error("Google did not grant offline calendar access.");
  }
  return token.refresh_token;
}

const dateField = z.object({
  date: z.string().optional(),
  dateTime: z.string().optional(),
  timeZone: z.string().optional(),
});
const eventsPage = z.object({
  timeZone: z.string().optional(),
  nextPageToken: z.string().optional(),
  nextSyncToken: z.string().optional(),
  items: z.array(
    z.object({
      id: z.string().min(1),
      status: z.string().optional(),
      summary: z.string().optional(),
      start: dateField.optional(),
      end: dateField.optional(),
      transparency: z.string().optional(),
      attendees: z
        .array(
          z.object({
            self: z.boolean().optional(),
            responseStatus: z.string().optional(),
          }),
        )
        .optional(),
    }),
  ),
});
const cursorSchema = z.object({
  day: z.string(),
  timezone: z.string(),
  token: z.string().min(1),
});

function activeToken(cursor: string | null, day: string, timezone: string) {
  if (!cursor) return null;
  try {
    const previous = cursorSchema.parse(JSON.parse(cursor));
    if (previous.day === day && previous.timezone === timezone)
      return previous.token;
  } catch {
    /* Old or invalid cursors can be replaced with a fresh snapshot. */
  }
  return null;
}

function eventDate(field: z.infer<typeof dateField>, timezone: string): Date {
  if (field.date) return localInputToDate(`${field.date}T00:00`, timezone);
  if (!field.dateTime)
    throw new Error("Google returned an event without a time.");
  if (/(?:[zZ]|[+-]\d\d:\d\d)$/.test(field.dateTime))
    return new Date(field.dateTime);
  return localInputToDate(field.dateTime, field.timeZone || timezone);
}

type SyncResult = {
  events: CalendarInputEvent[];
  removedIds: string[];
  nextCursor: string;
  full: boolean;
};

export async function syncGoogleCalendar(
  refreshToken: string,
  cursor: string | null,
  now: Date,
  timezone: string,
): Promise<SyncResult> {
  const { access_token: accessToken } = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const day = dayKey(now, timezone);
  // Five weeks back covers the four complete weeks before the current one.
  const from = localInputToDate(`${addDays(day, -35)}T00:00`, timezone);
  const until = localInputToDate(`${addDays(day, 31)}T00:00`, timezone);

  async function readPages(token: string | null): Promise<SyncResult | null> {
    const params = new URLSearchParams({
      singleEvents: "true",
      showDeleted: "true",
      maxResults: "2500",
      fields:
        "timeZone,nextPageToken,nextSyncToken,items(id,status,summary,start,end,transparency,attendees(self,responseStatus))",
    });
    if (token) params.set("syncToken", token);
    else {
      params.set("timeMin", from.toISOString());
      params.set("timeMax", until.toISOString());
    }

    const events = new Map<string, CalendarInputEvent>();
    const removed = new Set<string>();
    const seen = new Set<string>();
    for (;;) {
      const response = await fetch(`${GOOGLE_EVENTS}?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(12000),
      });
      if (response.status === 410 && token) return null;
      if (!response.ok) throw new Error("Could not read Google Calendar.");
      const page = eventsPage.parse(await response.json());
      for (const item of page.items) {
        const declined = item.attendees?.some(
          (attendee) => attendee.self && attendee.responseStatus === "declined",
        );
        if (
          item.status === "cancelled" ||
          item.transparency === "transparent" ||
          declined
        ) {
          events.delete(item.id);
          removed.add(item.id);
          continue;
        }
        if (!item.start || !item.end)
          throw new Error("Google returned an event without its time range.");
        const start = eventDate(item.start, page.timeZone || timezone);
        const end = eventDate(item.end, page.timeZone || timezone);
        if (
          !Number.isFinite(start.getTime()) ||
          !Number.isFinite(end.getTime())
        )
          throw new Error("Invalid Google event time.");
        if (start >= until || end <= from || end <= start) {
          events.delete(item.id);
          removed.add(item.id);
          continue;
        }
        removed.delete(item.id);
        events.set(item.id, {
          externalId: item.id,
          title: item.summary?.trim().slice(0, 300) || "Busy",
          start: start.toISOString(),
          end: end.toISOString(),
        });
      }
      if (!page.nextPageToken) {
        if (!page.nextSyncToken)
          throw new Error("Google did not return a calendar sync token.");
        const nextCursor = JSON.stringify({
          day,
          timezone,
          token: page.nextSyncToken,
        });
        return {
          events: [...events.values()],
          removedIds: [...removed],
          nextCursor,
          full: !token,
        };
      }
      if (seen.has(page.nextPageToken))
        throw new Error("Google repeated a calendar page.");
      seen.add(page.nextPageToken);
      params.set("pageToken", page.nextPageToken);
    }
  }

  // Google expires sync tokens with HTTP 410. Re-read the window before replacing any data.
  const token = activeToken(cursor, day, timezone);
  const result = (await readPages(token)) ?? (await readPages(null));
  if (!result) throw new Error("Could not reload Google Calendar.");
  return result;
}
