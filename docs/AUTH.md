# PWA sign-in

## Sign in with the default Supabase email

1. Open Compass from the home screen and choose **Send sign-in email**.
2. In your email app, touch and hold the sign-in button or link and select **Copy Link**. On desktop, right-click and copy the link address.
3. Return to Compass, paste it into **Sign-in link**, and select **Sign in**. If the link has expired or was already opened, send another email and copy the fresh link.

This uses the default Supabase email. For an email template that already includes a numeric code, choose **Enter a code instead**.

## Session and hosted verification

Compass stores the session in persistent cookies and carries refreshed cookies through sign-in redirects. Relaunching the app on the same device and site reuses that session until it expires, is revoked, or is cleared. **Sign out** ends the session in that browser or installed app.

Install Compass from the deployment you plan to use, request a fresh email, and paste its link into the app. Close and reopen Compass to verify it returns to your map.

## Iteration 11 — Support the default sign-in email

Paste the one-time link to finish sign-in in the same Compass window. The server accepts only the configured Supabase project's sign-in endpoint, reads the authorization code from its redirect without following it, and exchanges the code using the app's saved PKCE verifier.
