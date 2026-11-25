"use server";

import { headers } from "next/headers";
import { redirect, RedirectType } from "next/navigation";
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

/** The Supabase email template includes the code and may also include a link. */
export async function sendSignInCode(input: z.input<typeof emailInput>): Promise<ActionResult> {
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
  return { ok: true, message: "Check your email for the sign-in code." };
}

const codeInput = emailInput.extend({
  code: z.string().trim().regex(/^\d{6,10}$/, "Enter the numeric code from your email."),
});

export async function verifySignInCode(input: z.input<typeof codeInput>): Promise<ActionResult> {
  const parsed = codeInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your email and code.");
  const supabase = await createClient();
  const { email, code: token } = parsed.data;
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error?.status === 429) return fail("Too many attempts. Wait a little while and try again.");
  if (error && error.status !== undefined && error.status >= 500) return fail("Sign-in is temporarily unavailable. Try again in a moment.");
  if (error || !data.session) return fail("That code is incorrect or has expired. Check the latest email or send a new code.");
  redirect("/", RedirectType.replace);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
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
