# CLAUDE.md

Compass is a personal, gamified life dashboard: quests are long-running threads with dated checkpoints that feed five attributes (Body, Mind, Bonds, Craft, Spirit). It also has habits, a daily "inner weather" check-in, and a reflective logbook.

## Read first
- `docs/PRODUCT.md`: what we are building and why (concepts, points rules, onboarding, calendar).
- `docs/IMPLEMENTATION_PLAN.md`: stack, data model, milestones M0 to M8 with acceptance criteria.
- `docs/prototype/compass.html`: the original clickable reference. Still the reference for layout, copy tone and behaviour, but no longer for the look.

## Visual style
The app looks like a game character menu (Cyberpunk 2077 style HUD), not like the prototype:
- Neon on near-black ("Night City", default) with a light "Daylight" variant. Tokens in `src/styles/tokens.css`; red for chrome and headings, cyan (`--accent`) for focus and selection, yellow (`--brass`) for main quests, level and milestones.
- Fonts: Orbitron (brand, numbers), Rajdhani (text), Share Tech Mono (labels, data).
- Angular panels with cut corners and corner brackets, uppercase headings with a `//` prefix, segmented bars.
- Motion lives in `src/app/globals.css` and `src/components/fx.tsx` (decode text, count-up numbers, level-up, boot screen). Everything must still work with `prefers-reduced-motion: reduce`, where all animation is off.
- Decorative CSS text (`content:`) must use empty alt text (`content: "// " / ""`) so it stays out of accessible names.

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

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
