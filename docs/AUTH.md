# PWA sign-in

## Supabase email template

Before deploying code sign-in, open your Supabase dashboard and go to **Authentication → Email Templates**. Edit **Magic Link** and **Confirm signup**. Add this line to each template body.

```html
<p>Your Compass sign-in code is <strong>{{ .Token }}</strong>. Enter it in Compass.</p>
```

Keep the existing link in both templates during rollout. This lets users on older app versions sign in while the code flow is deploying.

## Iteration 10 — Sign in inside Compass

Request a code from Compass, read it in your email, and enter it in the same Compass window. You can paste the code or use your device’s one-time-code autofill. If the code expires, request another from the same screen.

Compass stores the session in persistent cookies and carries refreshed cookies through sign-in redirects. Relaunching the app on the same device and site reuses that session until it expires, is revoked, or is cleared. **Sign out** ends the session in that browser or installed app.

## Hosted verification

Install Compass from the deployment you plan to use. Request a code inside the installed app, enter it, then close and reopen Compass. Check that it returns to your map. Sign out and verify that reopening Compass shows the sign-in screen.
