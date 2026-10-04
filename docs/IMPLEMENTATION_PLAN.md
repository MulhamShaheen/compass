# Compass: Implementation Plan

Companion to [PRODUCT.md](PRODUCT.md). The plan is written to be executed step by step with Claude Code: each milestone is a small, shippable slice with acceptance criteria.

## 0. Decisions (defaults, change before starting if needed)

| Area | Choice | Why |
|---|---|---|
| Platform | **Phone-friendly web app (PWA)** | One codebase, works on phone and desktop, installable to the home screen. |
| Framework | **Next.js 16 (App Router) + TypeScript (strict)** | Server actions remove most API boilerplate; easy deploy. Moved from 15 to 16 for a security fix in the bundled PostCSS. |
| Styling | **Tailwind CSS v4** with CSS variables for theme tokens | Port the prototype's tokens directly (light/dark). |
| Fonts | Young Serif (display), IBM Plex Sans (body), IBM Plex Mono (data) via `next/font/google` | Matches prototype. |
| Data + auth | **Supabase** (Postgres, Auth with email magic link + Google, Row Level Security) | Hosted Postgres, auth and RLS in one; free tier is enough. |
| DB access | `@supabase/ssr` + generated TypeScript types; SQL migrations via Supabase CLI | Simple, no extra ORM. |
| Validation | `zod` for every server action input | |
| Charts | Hand-written SVG components (like the prototype) | Small, theme-aware, no heavy lib. |
| Dates | `date-fns` + `date-fns-tz`; store `timestamptz`, render in user's timezone | Checkpoints have date **and** time. |
| Tests | **Vitest** (game logic, utils), **Playwright** (critical flows) | |
| Hosting | **Vercel** (app + cron) + Supabase cloud | |
| Calendar (v1.1) | `node-ical` for ICS URLs; Google Calendar API (`googleapis`) read-only | iCloud works via public ICS URL. |

## 1. Repository layout

```
compass/
  CLAUDE.md
  README.md
  docs/                       # PRODUCT.md, IMPLEMENTATION_PLAN.md, prototype/
  supabase/
    migrations/               # numbered SQL migrations
    seed.sql                  # sample character for local dev
  src/
    app/
      (auth)/login/
      (app)/                  # authenticated shell
        page.tsx              # The map (dashboard)
        quests/[id]/page.tsx  # Quest thread
        review/page.tsx       # Weekly review
        settings/page.tsx
      prologue/               # onboarding flow, 5 steps
      api/export/route.ts     # JSON export
    components/               # UI: panels, chips, timeline, charts/
    lib/
      game/                   # PURE logic: points, levels, unlocks, slots, insights
      db/                     # supabase clients, typed queries
      actions/                # server actions (zod-validated)
      time.ts                 # week boundaries, relative dates, tz helpers
    styles/tokens.css         # theme tokens ported from prototype
  tests/
    unit/                     # vitest
    e2e/                      # playwright
```

## 2. Data model (Postgres)

All tables have `user_id uuid references auth.users not null` and RLS policy `user_id = auth.uid()` for all operations.

```sql
-- profile & settings
create table profiles (
  user_id uuid primary key references auth.users on delete cascade,
  character_name text,
  true_north text,
  timezone text not null default 'UTC',
  waking_start time default '07:00', waking_end time default '23:00',
  quiet_mode boolean not null default false,
  prologue_completed_at timestamptz,
  created_at timestamptz not null default now()
);

create type attribute as enum ('body','mind','bonds','craft','spirit');

create table chapters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  started_on date not null default current_date,
  ended_on date,
  summary text
);

-- baseline self-assessment from the Prologue (and later reviews)
create table attribute_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  attribute attribute not null,
  rating smallint not null check (rating between 1 and 5),
  context text not null default 'baseline',      -- 'baseline' | 'weekly_review'
  rated_at timestamptz not null default now()
);

create type quest_type as enum ('main','side','system');   -- 'system' = Prologue
create type quest_status as enum ('active','paused','done');

create table quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  chapter_id uuid references chapters,
  type quest_type not null,
  status quest_status not null default 'active',
  title text not null,
  why text,
  primary_attr attribute not null,
  secondary_attr attribute check (secondary_attr is distinct from primary_attr),
  started_on date not null default current_date,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table checkpoints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  quest_id uuid not null references quests on delete cascade,
  occurred_at timestamptz not null,
  title text not null,
  note text,
  minutes integer not null default 0 check (minutes >= 0),
  is_milestone boolean not null default false,
  source text not null default 'manual',          -- 'manual' | 'calendar' | 'system'
  source_ref text,                                 -- e.g. calendar event id
  created_at timestamptz not null default now()
);
create index on checkpoints (user_id, occurred_at desc);
create index on checkpoints (quest_id, occurred_at desc);

create table habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  kind text not null check (kind in ('keep','starve')),
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create table habit_logs (
  habit_id uuid not null references habits on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  primary key (habit_id, day)
);

create table weather_logs (
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  weather text not null check (weather in ('clear','breezy','cloudy','foggy','stormy')),
  primary key (user_id, day)
);

create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  day date not null,
  prompt text,
  body text not null,
  weather text,
  created_at timestamptz not null default now()
);

create table prompts (                              -- user-editable later; seed defaults
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,  -- null = global default
  text text not null,
  active boolean not null default true
);

create table unlocks (
  user_id uuid not null references auth.users on delete cascade,
  feature text not null,          -- 'habits','side_quests','character','where_life_goes','weekly_review','calendar'
  unlocked_at timestamptz not null default now(),
  primary key (user_id, feature)
);

create table weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  week_start date not null,
  note text,
  completed_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- v1.1 calendar
create table calendar_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('ics','google')),
  label text not null,
  ics_url text,                    -- encrypted at rest (pgsodium / Vault)
  google_refresh_token text,       -- encrypted at rest
  last_synced_at timestamptz
);
create table calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  source_id uuid not null references calendar_sources on delete cascade,
  external_id text not null,
  title text, starts_at timestamptz not null, ends_at timestamptz not null,
  all_day boolean not null default false,
  quest_id uuid references quests, attr attribute,      -- tag result
  suggestion_state text default 'none',                  -- 'none'|'suggested'|'logged'|'dismissed'
  unique (source_id, external_id)
);
create table calendar_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  match_text text not null,
  quest_id uuid references quests, attr attribute
);
```

**Points are never stored.** They are computed from `checkpoints` + quest attributes by `lib/game`. If this gets slow, add a SQL view `attribute_minutes_by_week`, but start in TypeScript.

## 3. Pure game logic (`src/lib/game`)

Write these first with unit tests. The UI only calls them.

- `checkpointPoints(cp) → number`: `minutes ? round(minutes/6) : 2`, plus 25 if milestone.
- `splitByAttributes(quest, value) → [attr, value][]`: 100% to primary, or 70/30 with a secondary attribute.
- `attributeTotals(quests, checkpoints, {since?}) → {points, minutes} per attr`
- `attributeLevel(points)` = `floor(p/150)+1`; `characterLevel(total)` = `floor(t/400)+1`, plus progress into the level.
- `weeklyHours(quests, checkpoints, weeks=12, tz) → [{weekStart, perAttr}]` with weeks starting Monday.
- `insight(totals) → string` (most and least time).
- `questSlots(level) → {main: 1, side: 3 + bonuses}`; `habitSlots(reviewsCompleted)`
- `evaluateUnlocks(state, now) → feature[]` implements the table in PRODUCT.md §3.2.
- `habitStreak(logs, today)`, `cleanDays(logs, last7)`
- `todayLoop(state, today) → {checkin, play, log}`

## 4. Milestones

Each milestone ends with: tests green, lint and typecheck clean, deployed preview, and a short manual check on a phone-width viewport.

### M0: Project setup
- Next.js + TS strict + Tailwind + ESLint + Prettier + Vitest + Playwright.
- Supabase project, CLI, first migration (`profiles`), generated types script (`npm run db:types`).
- `styles/tokens.css` ported from `docs/prototype/compass.html` (light and dark, attribute colors).
- Auth: magic link + Google (Google deferred); `src/proxy.ts` (Next 16's name for middleware) refreshes the session and protects app routes; profile row created on first sign in.
- **Done when:** you can sign in on a deployed preview and see an empty shell with header and theme.

### M1: Game logic library
- Implement everything in §3 with unit tests (aim for ≥ 95% coverage of `lib/game`).
- Fixture: port the prototype's sample character to `tests/fixtures/sample.ts`, and assert the same numbers the prototype shows.
- **Done when:** `npm test` passes; no UI yet.

### M2: Quests and checkpoints (the core)
- Migrations: `chapters`, `quests`, `checkpoints` + RLS.
- Server actions: create, update and pause/resume/complete quest; create, edit and delete checkpoint (zod).
- Quest list (filters: active/main/side/completed, 16-week pulse strip, last checkpoint).
- Quest thread page: header, stats, log-checkpoint form (title, commentary, datetime-local default now, time spent, milestone, live "earns X" preview), timeline with gap labels.
- Enforce quest slots on create/resume.
- **Done when:** you can run a quest for "months" using backdated checkpoints, and the numbers match the unit tests.

### M3: Character and Where life goes
- Character panel (levels, points, active quests, hours).
- Where life goes: 30d/90d/all toggle, horizontal share bars with labels, insight line, 12-week stacked SVG chart with hover tooltip and keyboard focus.
- Header: True North (inline edit), chapter title, character level bar.
- **Done when:** the dashboard matches the prototype using seeded data.

### M4: Daily layer
- Migrations: `weather_logs`, `habits`, `habit_logs`, `journal_entries`, `prompts` (seed 7 default prompts).
- Today panel (3-step loop derived from data), inner weather picker, habits (keep/starve, 7-day strip, streak), logbook (rotating prompt, entries list).
- Enforce habit slots.
- **Done when:** a full day loop can be completed on a phone.

### M5: The Prologue and unlocks
- Migrations: `attribute_ratings`, `unlocks`; `quest_type` includes `system`.
- `/prologue` 5-step flow (one question per screen, skip where allowed, progress dots, back button). It creates the profile fields, the first chapter, baseline ratings, the first main quest with a "The quest begins" checkpoint, and the first weather log, plus a hidden system quest "Prologue" with a checkpoint per step.
- Redirect to `/prologue` until `prologue_completed_at` is set.
- `evaluateUnlocks` runs after each action. Newly unlocked features show a one-time card, and each one adds a checkpoint to the Prologue quest.
- Locked sections render as quiet cards ("Opens after 3 checkpoints"). Add the quiet mode toggle in settings.
- **Done when:** a brand new user sees only Today, one quest and the logbook, and the rest appears over a simulated week (e2e test with a mocked clock).

### M6: Weekly review
- `/review`: (1) the week's where-life-goes chart against True North, (2) pause/resume/begin quests within slots, (3) a logbook entry "What will next week be about?". Optional re-rating of attributes is stored as `weekly_review` ratings.
- Prompt to review on Sunday and Monday if none exists for the week.
- **Done when:** completing a review unlocks a habit slot and appears in the Prologue/history.

### M7: PWA, export, polish
- Web app manifest, icons, `display: standalone`, theme color; basic offline shell (service worker caching static assets only).
- `GET /api/export` returns all of the user's data as JSON; delete-account flow.
- Accessibility pass (focus states, labels, reduced motion), empty states, loading skeletons.
- **Done when:** installable on iPhone/Android, Lighthouse PWA + a11y ≥ 90.

### M8 (v1.1): Calendar
- `calendar_sources`, `calendar_events`, `calendar_rules` + RLS; secrets stored with Supabase Vault.
- ICS: add URL, then a server sync using `node-ical`, expand recurring events for −30 to +30 days, and upsert by `external_id`.
- Google: OAuth with `calendar.readonly`, store the refresh token, and sync with incremental `syncToken`.
- Vercel Cron every 30 min → `/api/cron/calendar-sync` (protected with `CRON_SECRET`).
- Free time = waking hours − merged busy intervals per day (pure function in `lib/game/time.ts` with tests).
- Time panel: week strip busy vs free, "free hours this week" vs the 4-week average.
- Rules: text match → quest/attribute. Matching past events become **suggestions**, and the user confirms them to create a checkpoint (`source='calendar'`).
- **Done when:** an iCloud public calendar URL shows correct free time for this week, and a tagged event can be logged as a checkpoint in one tap.

## 5. Conventions for Claude Code

- Keep **all game rules in `src/lib/game`** as pure functions with tests. Components never compute points.
- Every server action validates input with zod and relies on RLS. Never trust a `user_id` sent by the client.
- Store `timestamptz`; convert with the profile timezone at the edges. A "day" is always computed in the user's timezone.
- Colors come only from tokens in `styles/tokens.css`. Attribute colors are `--a-body`, `--a-mind`, `--a-bonds`, `--a-craft`, `--a-spirit`.
- UI copy follows the prototype: plain, warm, no exclamation marks, and no guilt ("Tomorrow is a clean page.").
- Before each milestone, re-read the matching section of PRODUCT.md. After it, update the checklist in README.md.

## 6. Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=   # the sb_publishable_… key (formerly the anon key)
SUPABASE_SERVICE_ROLE_KEY=        # server only (cron sync)
GOOGLE_CLIENT_ID=                 # v1.1
GOOGLE_CLIENT_SECRET=             # v1.1
CRON_SECRET=                      # v1.1
```

## 7. Risks and open questions

- **Timezones and DST** affect week bucketing and "today". Test with Europe/Moscow and America/New_York fixtures.
- **Points balance:** 10/hour may over-reward long passive time. Keep the formula in one function and revisit it after 2 weeks of real use.
- **Calendar privacy:** store only event title and time; let the user exclude calendars; never send events anywhere else.
- **Open:** do habits ever give points? (Currently no.) Should attributes be customizable? (v1: fixed five.)
