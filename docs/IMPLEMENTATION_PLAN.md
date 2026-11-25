# Compass implementation plan

The [product spec](PRODUCT.md) describes how Compass works. The [README](../README.md) covers setup, testing, and deployment.

## 1. Architecture

- Next.js 16 App Router, TypeScript, and React serve the dashboard and server actions. Tailwind CSS and the tokens in `src/styles/tokens.css` define the themes. The app uses Orbitron, Rajdhani, and Share Tech Mono.
- Supabase provides Postgres and email magic-link sign-in. Row Level Security limits access to each user's data. The Next.js proxy refreshes the session. Local development and the default browser suite can use a JSON file.
- Zod validates server-action input. The core store maps rows to the model in `src/lib/db/schema.ts`. The calendar store handles providers and keeps their secrets in Supabase Vault in hosted environments.
- SQL files in [supabase/migrations](../supabase/migrations) define the schema and policies. TypeScript definitions live in [src/lib/db/types.ts](../src/lib/db/types.ts).

## 2. Data model

| Area | Tables |
| --- | --- |
| Account and game | `profiles`, `chapters`, `quests`, `checkpoints`, `attribute_ratings`, `unlocks` |
| Daily and weekly activity | `weather_logs`, `habits`, `habit_logs`, `journal_entries`, `prompts`, `weekly_reviews`, `today_next_steps` |
| Calendar | `calendar_sources`, `calendar_events`, `calendar_rules`, `calendar_dismissals` |

The store can still import an older character from `prototype_state`. Checkpoints feed points and time totals. The Today plan belongs to the active main quest. A linked checkpoint and the removal of its plan commit together in Supabase.

## 3. Game rules and verification

Pure functions in `src/lib/game` calculate points, levels, quest and habit slots, unlocks, streaks, and free time. The profile timezone defines a day and the start of each Monday-to-Sunday week. Timestamps are stored as `timestamptz`.

Vitest covers the rules and server behavior. Playwright exercises the first week, Today, calendar, review, export, and accessibility. The Supabase suite also checks access rules and deletion. See [test commands](../README.md#checks).

## 4. Milestones

| Milestone | What landed on main |
| --- | --- |
| M0 | Next.js, Supabase magic-link sign-in, themes, and local development mode |
| M1–M3 | Rules, quests and checkpoints, Character, and Where life goes |
| M4–M6 | Today, weather, habits, logbook, Prologue unlocks, and weekly review |
| M7 | Installable PWA and offline shell, JSON export, account deletion, and accessibility checks |
| M8 | Read-only ICS and primary Google Calendar sync, free-time estimates, tagging, preview, and dismissal |
| Daily flow | Weekly calendar reflection and one optional next step on Today |

**In review:** Evening checkpoint reflection adds an optional prompt based on a checkpoint that occurred today. It saves the quest and checkpoint titles with the entry. [PR #5](https://github.com/MulhamShaheen/compass/pull/5)

### Hosted release checks

- Verify email magic-link sign-in on a deployed preview.
- Install the PWA on a real iPhone and Android device.
- Complete the live iCloud and Google checks in the [calendar setup](../README.md#calendar-setup).

## 5. Next feature

**Chapter Review** is the selected proposal. At the end of a chapter, the user picks a quest and sees its first and latest checkpoints within the chapter. They can answer **What changed over this chapter?** and save their reflection in the logbook with the quest and checkpoint titles.

- Use the chapter dates and the profile timezone to select eligible checkpoints. If a quest has fewer than two, explain why there is no pair to compare.
- Make the reflection optional. Verify it still reads clearly in the logbook and JSON export after a checkpoint is renamed.
- Try the flow with a chapter that spans several weeks. Check whether comparing two moments helps the user describe a change the weekly review would miss.

The [calendar iteration notes](CALENDAR_ITERATIONS.md#product-ideas-for-review) keep the remaining experiments for later review.

## 6. Environment variables

Use [`.env.example`](../.env.example) as the inventory and follow the [README deployment instructions](../README.md#supabase-and-vercel).
