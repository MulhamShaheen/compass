# Compass

Compass is a personal dashboard for long-running quests. Log checkpoints to record progress and see where your time goes. Today brings together your main quest, an optional next step, inner weather, habits, and the logbook.

## Run locally

Use Node.js 24 and install the locked dependencies with `npm ci`.

```sh
COMPASS_STORE=local npm run dev
```

Open http://localhost:3000. Local mode stores one character in `.data/compass.json` and skips sign-in. **Load sample character** opens a populated map. **Next day** advances the app clock, and **Real time** resets it. Use a disposable character for **Load sample character** and **Start over**, which replace or erase its data.

### Supabase and Vercel

1. Copy [`.env.example`](.env.example) to `.env`. Fill in the Supabase URL and publishable key, plus either the database URL or the project reference, region, and database password.
2. Run `npm run db:migrate` to apply all pending migrations. Use `npm run db:migrate -- --status` to list them.
3. Run `npm run dev`, request a sign-in email, and paste the link into Compass. [PWA sign-in instructions](docs/AUTH.md)
4. For Vercel, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Production and Preview. In Supabase Auth, set the Site URL to the production URL and allow the localhost and preview redirect URLs you use. Supabase's built-in email sender is limited to project-team addresses. Configure custom SMTP for other users.

### Checks

```sh
npm test
npm run lint
npm run typecheck
npx playwright install chromium
npm run test:e2e
```

The browser suite uses a separate local data file and a phone viewport. Run `npm run test:e2e:supabase` against a dedicated Supabase test project configured in `.env`. It creates and removes accounts matching `e2e-*@compass.test` and checks access rules and account deletion.

### Calendar migration history

If `db:migrate` stops because `calendar_sources` already exists, use the history repair command. This can happen when the calendar SQL was applied manually and its version was never recorded.

```sh
npm run db:migrate -- --repair-calendar-history
npm run db:migrate -- --status
npm run db:migrate
```

The repair compares the installed calendar tables, constraints, policies, privileges, indexes and functions against the calendar migrations. It records the matching versions in migration history and preserves existing calendar data. If any objects differ or are missing, the repair stops and lists the differences. Use those results to investigate the schema before running further migrations.

## Calendar setup

1. Apply all pending migrations. The calendar uses Supabase Vault for credentials. Set `SUPABASE_SERVICE_ROLE_KEY` in the server environment for calendar connections and sync. Local mode can sync an ICS feed with its file store.
2. Complete the first weekly review and open **Time**. The sample character also unlocks it. Add a read-only HTTPS or webcal ICS subscription, set waking hours, and create a title rule for a quest or attribute.
3. For Google Calendar, enable the Google Calendar API and configure OAuth consent and any test users. Use a web application OAuth client and register `https://<your-app-host>/api/calendar/google/callback` for each host. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the server, then connect your primary calendar from **Time**.
4. For scheduled sync, set `CRON_SECRET` on Vercel. The checked-in schedule runs daily at 04:00 UTC. A supported Vercel plan can run it more frequently, or an external scheduler can send a GET to `/api/cron/calendar-sync` with `Authorization: Bearer <CRON_SECRET>`. You can also use **Sync** on demand.

On the hosted app, compare free time against a real iCloud feed and confirm a matching past event. For Google, complete consent and confirm that an event change appears after sync.

## Documentation

- [Product spec](docs/PRODUCT.md) covers the experience, scoring, onboarding, and calendar behavior.
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md) tracks what landed, release checks, and the proposed Chapter Review.
- [Daily flow notes](docs/DAILY_FLOW.md) and [calendar iteration notes](docs/CALENDAR_ITERATIONS.md) record the decisions and checks behind each change.
- [Events and Google publishing](docs/EVENTS.md) covers points, calendar files, and the optional Google connection.
- [PWA sign-in](docs/AUTH.md) covers email code setup and session checks.
- [Original prototype](docs/prototype/compass.html) captures the early interaction design.
- [Contributor guidance](CLAUDE.md) describes engineering and design conventions.
