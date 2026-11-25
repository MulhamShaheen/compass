"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadDb } from "@/lib/db/store";
import {
  googleWriteAccessToken, publishGoogleEvent, removeGoogleEvent,
} from "@/lib/events/google";
import {
  beginGooglePublication, disconnectGooglePublishing, finishGooglePublication, googlePublishingConfigured,
} from "@/lib/events/google-store";
import { currentUser } from "@/lib/supabase/server";
import { fail, type ActionResult } from "./run";

export async function publishEventToGoogle(id: string, publish: boolean): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success || typeof publish !== "boolean") return fail("Choose a valid event.");
  if (!googlePublishingConfigured()) return fail("Google Calendar publishing is unavailable.");
  const user = await currentUser();
  if (!user) return fail("Sign in to use Google Calendar.");
  const event = (await loadDb()).events.find((item) => item.id === id);
  if (!event) return fail("This event is no longer in Compass.");

  try {
    const operation = await beginGooglePublication(user.id, id, publish);
    if (!operation) return fail("Check the Google connection or try again after the current operation finishes.");
    let succeeded = false;
    try {
      const token = await googleWriteAccessToken(operation.secret);
      const remoteId = operation.remote_id.replaceAll("-", "");
      if (publish) await publishGoogleEvent(token, operation.calendar_id, remoteId, event);
      else await removeGoogleEvent(token, operation.calendar_id, remoteId);
      succeeded = true;
    } finally {
      const finished = await finishGooglePublication(user.id, id, operation.operation_id, publish, succeeded);
      revalidatePath("/events");
      if (!finished) throw new Error("The Google operation expired.");
    }
    return { ok: true, message: publish ? "Saved to Google Calendar." : "Removed from Google Calendar." };
  } catch {
    return fail("Could not finish the Google Calendar change. Try again or reconnect Google Calendar.");
  }
}

export async function disconnectGoogleEvents(): Promise<ActionResult> {
  if (!googlePublishingConfigured()) return fail("Google Calendar publishing is unavailable.");
  const user = await currentUser();
  if (!user) return fail("Sign in to use Google Calendar.");
  try {
    if (!(await disconnectGooglePublishing(user.id))) return fail("Wait for the current Google operation to finish.");
    revalidatePath("/events");
    return { ok: true, message: "Google Calendar disconnected." };
  } catch {
    return fail("Could not disconnect Google Calendar.");
  }
}
