"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { deleteAccount as deleteAccountData } from "../db/store";
import { createClient } from "../supabase/server";
import { fail, type ActionResult } from "./run";

const emailInput = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ message: "That email address looks incomplete." })),
});

function friendly(message: string, status?: number): string {
  if (status === 429 || /rate limit/i.test(message)) return "Too many sign-in emails for now. Try again in a little while.";
  if (/not authorized/i.test(message)) {
    return "This address can't receive sign-in emails yet. The project's email sender only allows its team's addresses until custom SMTP is set up.";
  }
  return "The sign-in email could not be sent. Try again in a moment.";
}

/** Sends a one-time sign-in link. New addresses get an account on first use. */
export async function sendMagicLink(input: z.input<typeof emailInput>): Promise<ActionResult> {
  const parsed = emailInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "That email address looks incomplete.");
  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return fail(friendly(error.message, error.status));
  return { ok: true, message: "Link sent. Check your inbox." };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Deletes the account and everything in it, then returns to the sign-in page. */
export async function deleteAccount(): Promise<ActionResult> {
  try {
    await deleteAccountData();
  } catch (e) {
    return fail(e instanceof Error ? e.message : "The account could not be deleted. Try again.");
  }
  redirect("/login");
}
