import { z } from "zod";
import { tokenRequest } from "@/lib/calendar/google";
import type { CompassEvent } from "@/lib/db/schema";

export const googleWriteScope = "https://www.googleapis.com/auth/calendar.app.created";
export const googleWriteCallback = "/api/events/google/callback";
export const googleWriteCookie = "compass_events_pkce";

const googleCalendarApi = "https://www.googleapis.com/calendar/v3";

export async function googleWriteAccessToken(refreshToken: string) {
  const { access_token } = await tokenRequest({
    grant_type: "refresh_token", refresh_token: refreshToken,
  });
  return access_token;
}

function request(token: string, path: string, method: string, body?: object) {
  return fetch(googleCalendarApi + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(12000),
  });
}

export async function createGoogleEventsCalendar(token: string): Promise<string> {
  const response = await request(token, "/calendars", "POST", { summary: "Compass Events" });
  if (!response.ok) throw new Error("Google could not create the Compass Events calendar.");
  const value = z.object({ id: z.string().min(1) }).parse(await response.json());
  return value.id;
}

export async function deleteUnusedGoogleCalendar(token: string, calendarId: string) {
  await request(token, `/calendars/${encodeURIComponent(calendarId)}`, "DELETE");
}

export async function publishGoogleEvent(
  token: string, calendarId: string, remoteId: string, event: CompassEvent,
) {
  const path = `/calendars/${encodeURIComponent(calendarId)}/events`;
  const individual = `${path}/${remoteId}?sendUpdates=none`;
  const body = {
    id: remoteId,
    summary: event.title,
    description: event.note ?? "",
    start: { dateTime: event.startsAt },
    end: { dateTime: event.endsAt },
  };
  const update = await request(token, individual, "PUT", body);
  if (update.ok) return;
  if (update.status !== 404) throw new Error("Google could not update this event.");
  const create = await request(token, `${path}?sendUpdates=none`, "POST", body);
  if (create.ok) return;
  if (create.status === 409 && (await request(token, individual, "PUT", body)).ok) return;
  throw new Error("Google could not publish this event.");
}

export async function removeGoogleEvent(token: string, calendarId: string, remoteId: string) {
  const response = await request(token, `/calendars/${encodeURIComponent(calendarId)}/events/${remoteId}?sendUpdates=none`, "DELETE");
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    throw new Error("Google could not remove this event.");
  }
}
