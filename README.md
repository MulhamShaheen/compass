# Compass

A gamified life dashboard. Life is one storyline: main and side quests run for months, checkpoints record the story, and five attributes show where your time goes. It includes habits, a daily inner-weather check-in and a reflective logbook.

- Product spec: [docs/PRODUCT.md](docs/PRODUCT.md)
- Implementation plan: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)
- Prototype: [docs/prototype/compass.html](docs/prototype/compass.html) (open in a browser)
- Instructions for Claude Code: [CLAUDE.md](CLAUDE.md)

## Getting started with Claude Code

1. Create an empty repo and copy this folder into it (`README.md`, `CLAUDE.md`, `docs/`).
2. Create a Supabase project and a Vercel project, and keep the keys ready (see plan §6).
3. Open the repo in Claude Code and say:
   > Read CLAUDE.md and docs/. Start milestone M0 and stop when its "Done when" is met.
4. Review, then continue with M1, M2, and so on.

## Run the app

Data lives in Supabase, per signed-in user, behind Row Level Security. Sign-in is an email magic link.

```bash
npm install
cp .env.example .env   # fill in the Supabase values
npm run db:migrate     # applies supabase/migrations (add --status to just list them)
npm run dev            # http://localhost:3000
npm test               # unit tests for src/lib/game
npm run test:e2e       # Playwright, phone viewport, local file store, no sign-in
npm run test:e2e:supabase  # same flows + access rules against Supabase
```

`COMPASS_STORE=local` runs without Supabase or sign-in on a local JSON file (`.data/compass.json`). The e2e tests use it; it cannot work on Vercel.

Each table holds only its owner's rows (Row Level Security). `npm run test:e2e:supabase` runs the browser flows and the access rules against the real project, as throwaway `e2e-*@compass.test` users that it deletes afterwards.

### Supabase and Vercel settings

- **Vercel → Settings → Environment Variables** (Production and Preview): `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Redeploy after adding them.
- **Supabase → Authentication → URL Configuration**: Site URL is your production URL. Redirect URLs include `http://localhost:3000/**` and `https://compass-*-mulham-s-team.vercel.app/**` (previews).
- Supabase's built-in email sender only delivers to the project team's addresses, a few emails per hour. Set up custom SMTP before inviting anyone else.

A dashed **prototype bar** at the bottom of each page holds testing tools: **Next day** moves the app clock forward to simulate the first week, **Real time** resets it, **Load sample character** loads the prototype's example character (also offered on the first Prologue screen), and **Start over** erases everything. They only touch your own data.

### Manual test script

1. Sign in with your email, open the link in the same browser. You land on the Prologue. Play the 5 screens (step 4, the first quest, cannot be skipped).
2. The map shows only the header, Today, your one quest and the logbook. The rest is locked, and each locked card says what opens it.
3. Try to begin a second main quest: the slot is taken.
4. Open the quest, log a checkpoint (watch the live "Earns …" preview), then edit or remove it. Points recompute.
5. Write a logbook entry. The Today loop ticks off as you go.
6. Press **Next day** and check in again: Habits open (1 keep + 1 starve). Keep pressing: side quests open on day 4, Where life goes and the weekly review on day 7.
7. Finish the weekly review: a habit slot is added, and the review shows in your Prologue (link under the quest list).
8. Settings: quiet mode, timezone, JSON export.
9. **Load sample character** to see a full map that matches `docs/prototype/compass.html`.

## Calendar setup

After the first weekly review, open **Time** in the navigation. Loading the sample character also unlocks it for local testing. Connect a read-only HTTPS or webcal ICS subscription, set waking hours and add a title rule for an active quest or an attribute. Past matching events appear under **Suggested checkpoints**. Disconnecting removes imported events and keeps checkpoints you chose to log.

Use **Preview matches** before saving a rule to see up to three recent events it would suggest. Open **Why this was suggested** on a suggestion to see the matching rules. **Dismiss** hides that occurrence from suggestions. Its time still counts as busy, and future occurrences can still be suggested.

1. In your Supabase deployment, apply the pending migration with `npm run db:migrate` using the project’s database settings in your local `.env`. The migration installs Supabase Vault and creates the calendar tables, access policies and functions. Put `SUPABASE_SERVICE_ROLE_KEY` in the server environment for the app. Local file mode can sync an ICS source without this setup.
2. For Google Calendar, enable the Google Calendar API, configure the OAuth consent screen and any test users, and create a **Web application** OAuth client. Register the exact URL `https://<your-app-host>/api/calendar/google/callback` for each host you use. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` on the server. Each user connects their own primary Google calendar from **Time**.
3. For scheduled sync, set a random `CRON_SECRET` on Vercel. The default Vercel schedule runs daily, which works on Hobby plans. To use the 30-minute interval in the implementation plan, set the schedule to `*/30 * * * *` on a supported Vercel plan, or configure a scheduler to send a GET to `/api/cron/calendar-sync` every 30 minutes with `Authorization: Bearer <CRON_SECRET>`. The **Sync** button works independently.
4. On the deployed app, connect an iCloud subscription, compare this week’s free hours with the source, and confirm one matching past event. For Google, complete consent and verify that a change on the primary calendar appears after sync.

If the calendar is already set up, run `npm run db:migrate` again to apply the dismissal migration. Rule previews and match explanations work while that migration is pending.

The [iteration log and idea backlog](docs/CALENDAR_ITERATIONS.md) records the design choices, checks and follow-up experiments.

## Progress

- [ ] M0: Project setup (Next.js 16, Supabase, auth, tokens). Everything is in place and tested against Supabase; open: one sign-in on the deployed preview (needs the Vercel env vars and Supabase redirect URLs above).
- [x] M1: Game logic library + tests
- [x] M2: Quests and checkpoints
- [x] M3: Character and Where life goes
- [x] M4: Daily layer (weather, habits, logbook)
- [x] M5: The Prologue onboarding and unlocks
- [x] M6: Weekly review
- [x] M7: PWA, export, polish (installable manifest and icons, offline shell, JSON export, delete account, loading skeletons, axe + Lighthouse accessibility 100). Still to try: installing on a real iPhone and Android phone.
- [ ] M8 (v1.1): ICS and Google Calendar sync, free time and event tagging implemented. Open acceptance check: verify a real iCloud feed and one-tap checkpoint on the deployed app.

All data lives in the full table model (plan §2) with owner-only Row Level Security, checked by `npm run test:e2e:supabase`. The earlier `prototype_state` table is only read once, to import state saved before the move; it can be dropped once nobody has rows there.
