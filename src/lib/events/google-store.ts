import "server-only";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { isLocalMode, supabaseEnv } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";

function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Google publishing requires a server-side Supabase service role key.");
  return createClient(supabaseEnv().url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function googlePublishingConfigured() {
  return !isLocalMode() && Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

const statusSchema = z.object({ connected: z.boolean(), publishedIds: z.array(z.string().uuid()) });
const emptyStatus = { connected: false, publishedIds: [] } as z.infer<typeof statusSchema>;
const operationSchema = z.object({
  calendar_id: z.string(), secret: z.string(), remote_id: z.string().uuid(), operation_id: z.string().uuid(),
});

export async function readGooglePublishing(userId: string) {
  const { data, error } = await serviceClient().rpc("google_events_status", { p_user: userId });
  if (error?.code === "PGRST202" || error?.code === "42883") return null;
  if (error) throw new Error("Google publishing status is unavailable.");
  return statusSchema.parse(data);
}

export async function googlePublishingView() {
  const available = googlePublishingConfigured();
  if (isLocalMode() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { available: false, ...emptyStatus };
  const user = await currentUser();
  if (!user) return { available: false, ...emptyStatus };
  // Google availability should never prevent creating or exporting a Compass event.
  const status = await readGooglePublishing(user.id).catch(() => null);
  return { available: available && Boolean(status), ...(status ?? emptyStatus) };
}

export async function hasEventPublication(id: string) {
  if (isLocalMode() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  const user = await currentUser();
  if (!user) return false;
  return (await readGooglePublishing(user.id))?.publishedIds.includes(id) ?? false;
}

export async function saveGooglePublishing(userId: string, calendarId: string, refreshToken: string) {
  const { data, error } = await serviceClient().rpc("google_events_connect", {
    p_user: userId, p_calendar: calendarId, p_secret: refreshToken,
  });
  if (error) throw new Error("Could not save the Google Calendar connection.");
  return data === true;
}

export async function disconnectGooglePublishing(userId: string) {
  const { data, error } = await serviceClient().rpc("google_events_disconnect", { p_user: userId });
  if (error) throw new Error("Could not disconnect Google Calendar.");
  return data === true;
}

export async function beginGooglePublication(userId: string, eventId: string, publish: boolean) {
  const { data, error } = await serviceClient().rpc("google_events_begin", {
    p_user: userId, p_event: eventId, p_publish: publish,
  });
  if (error) throw new Error("Could not start Google Calendar publishing.");
  const operation = z.array(operationSchema).parse(data)[0];
  return operation ?? null;
}

export async function finishGooglePublication(
  userId: string, eventId: string, operationId: string, publish: boolean, succeeded: boolean,
) {
  const { data, error } = await serviceClient().rpc("google_events_finish", {
    p_user: userId, p_event: eventId, p_operation: operationId, p_publish: publish, p_ok: succeeded,
  });
  if (error) throw new Error("Could not record the result from Google Calendar.");
  return data === true;
}
