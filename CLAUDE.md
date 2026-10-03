# CLAUDE.md

Compass is a personal, gamified life dashboard: quests are long-running threads with dated checkpoints that feed five attributes (Body, Mind, Bonds, Craft, Spirit). It also has habits, a daily "inner weather" check-in, and a reflective logbook.

## Read first
- `docs/PRODUCT.md`: what we are building and why (concepts, points rules, onboarding, calendar).
- `docs/IMPLEMENTATION_PLAN.md`: stack, data model, milestones M0 to M8 with acceptance criteria.
- `docs/prototype/compass.html`: the clickable visual reference. Match its layout, tokens, copy tone and behaviour.

## How to work
- Build milestone by milestone, in order. Don't start a milestone before the previous one's "Done when" is met.
- After finishing a milestone, tick it in `README.md` and summarise what changed.
- All game rules (points, levels, unlocks, slots, streaks, free time) live in `src/lib/game` as pure, unit-tested functions. Components and server actions call them and never re-implement them.
- Server actions validate with zod. Data access goes through Supabase with Row Level Security. Never accept `user_id` from the client.
- Times are stored as `timestamptz`. "Today" and week boundaries are computed in the user's profile timezone. Weeks start on Monday.
- Colors only come from CSS tokens in `src/styles/tokens.css` (light and dark). No literal colors in components.
- Mobile first: every screen must work at 390px wide.

## Commands
- `npm run dev`: start the app
- `npm test`: Vitest unit tests
- `npm run test:e2e`: Playwright
- `npm run lint && npm run typecheck`
- `npm run db:types`: regenerate Supabase types after a migration

## Copy tone
Plain, warm, and short. No exclamation marks, guilt or streak shaming. For example: "Tomorrow is a clean page." and "Log the first checkpoint above."
