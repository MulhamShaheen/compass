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

## Run the playable prototype

The app runs today without Supabase: a local JSON store (`.data/compass.json`, git-ignored) stands in for the database until M0 is connected. Everything else (game rules, server actions with zod, screens) is the real app.

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # unit tests for src/lib/game
npm run test:e2e     # Playwright, phone viewport, uses its own data file
```

A dashed **prototype bar** at the bottom of each page holds testing tools: **Next day** moves the app clock forward to simulate the first week, **Real time** resets it, **Load sample character** loads the prototype's example character (also offered on the first Prologue screen), and **Start over** erases everything.

### Manual test script

1. Open the app. You land on the Prologue. Play the 5 screens (step 4, the first quest, cannot be skipped).
2. The map shows only the header, Today, your one quest and the logbook. The rest is locked, and each locked card says what opens it.
3. Try to begin a second main quest: the slot is taken.
4. Open the quest, log a checkpoint (watch the live "Earns …" preview), then edit or remove it. Points recompute.
5. Write a logbook entry. The Today loop ticks off as you go.
6. Press **Next day** and check in again: Habits open (1 keep + 1 starve). Keep pressing: side quests open on day 4, Where life goes and the weekly review on day 7.
7. Finish the weekly review: a habit slot is added, and the review shows in your Prologue (link under the quest list).
8. Settings: quiet mode, timezone, JSON export.
9. **Load sample character** to see a full map that matches `docs/prototype/compass.html`.

## Progress

- [ ] M0: Project setup (Next.js, Supabase, auth, tokens). Done: Next.js 15, TS strict, Tailwind v4, ESLint, Prettier, Vitest, Playwright, tokens. Open: Supabase, auth, deployed preview.
- [x] M1: Game logic library + tests
- [ ] M2: Quests and checkpoints
- [ ] M3: Character and Where life goes
- [ ] M4: Daily layer (weather, habits, logbook)
- [ ] M5: The Prologue onboarding and unlocks
- [ ] M6: Weekly review
- [ ] M7: PWA, export, polish
- [ ] M8 (v1.1): Calendar (ICS + Google), free time, event tagging

Prototype status: M2 to M6 are playable against the local store (quests and checkpoints with slots, character, where life goes, today/weather/habits/logbook, the Prologue with unlocks, the weekly review). They stay unticked until they run on Supabase with RLS, as the plan requires.
