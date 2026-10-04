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

## Progress

- [ ] M0: Project setup (Next.js 16, Supabase, auth, tokens). Everything is in place and tested against Supabase; open: one sign-in on the deployed preview (needs the Vercel env vars and Supabase redirect URLs above).
- [x] M1: Game logic library + tests
- [x] M2: Quests and checkpoints
- [x] M3: Character and Where life goes
- [x] M4: Daily layer (weather, habits, logbook)
- [x] M5: The Prologue onboarding and unlocks
- [x] M6: Weekly review
- [x] M7: PWA, export, polish (installable manifest and icons, offline shell, JSON export, delete account, loading skeletons, axe + Lighthouse accessibility 100). Still to try: installing on a real iPhone and Android phone.
- [ ] M8 (v1.1): Calendar (ICS + Google), free time, event tagging

All data lives in the full table model (plan §2) with owner-only Row Level Security, checked by `npm run test:e2e:supabase`. The earlier `prototype_state` table is only read once, to import state saved before the move; it can be dropped once nobody has rows there.
