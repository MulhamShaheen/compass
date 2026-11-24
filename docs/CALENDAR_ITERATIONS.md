# Compass calendar development

A quest records moments someone chooses to remember. A calendar offers evidence of where time went. Imported time affects the busy/free view immediately. Only confirming a past event creates a checkpoint and awards points.

## Iteration 1 — Scope and acceptance

Follow the first weekly review with a read-only calendar connection. Start with ICS, then support the primary Google calendar. The acceptance check is to connect an iCloud feed, compare this week’s free time against the calendar, and log a past tagged event in one tap. The account owner will need to complete live consent and the deployed check. The original scope is in [Product](PRODUCT.md#4-calendar-and-future-metrics) and the [implementation plan](IMPLEMENTATION_PLAN.md#4-milestones).

## Iteration 2 — Design choices

- Count time once when calendars overlap. Compute free time inside the user’s waking hours and compare against four preceding Monday-to-Sunday weeks in the profile timezone.
- Match a title fragment to a quest or attribute. Keep the suggestion optional and require an active quest for confirmation. Preserve a confirmed checkpoint if the calendar source disappears.
- Keep connection secrets behind server-only operations. Support a manual retry as well as a scheduled sync, and accept a sync result only if the source still has the version the worker read.
- Treat the calendar as optional after the first weekly review. The game’s existing unlock keeps the Prologue focused on a first quest.

## Iteration 3 — Integration and release

The calendar screen supports ICS and primary Google Calendar connections, manual refresh, waking hours and title rules. A phone-width browser run caught a quest-selection bug in the rule form. The fix removes the full target prefix before saving the quest ID. The browser check exercises the resulting suggestion, retries confirmation from a second tab, and verifies that disconnecting keeps the checkpoint. It also checks that the export omits the subscription URL and sync cursor.

The production migration places credentials in Supabase Vault. An isolated PostgreSQL check used substitutes for Auth and Vault to verify SQL execution, owner-only access, sync version checks and cleanup. Live Supabase Vault, iCloud and Google consent still need the account owner’s deployment settings.

The Vercel schedule defaults to daily so deploying on Hobby works. Enable the planned 30-minute interval on a compatible plan or with a separate scheduler. The time estimate uses waking hours and imported events. Recurring work hours remain a product experiment.

The [calendar setup checklist](../README.md#calendar-setup) covers migration, environment variables and the deployed acceptance check.

## Product ideas for review

These are proposals for later iterations. Pick one question to try with a real week of use before expanding the feature.

| Idea | Smallest experiment | What to learn |
| --- | --- | --- |
| Explain and preview tagging rules | Show the matching phrase, candidate quest, and three recent matches while editing a rule. | Can someone spot a rule that will suggest the wrong events? |
| Snooze or dismiss suggestions | Hide one occurrence or defer it to the weekly review. | Do people feel comfortable leaving an event unlogged? |
| Busy-only calendar privacy | Offer a per-source option to discard titles and retain intervals. | Will users include sensitive calendars when titles stay private? |
| Memorable planned moments | Ask which scheduled activity became a checkpoint worth remembering. | Does looking back at planned time reveal a moment the user wants to keep? |
| True North reflection | Invite the user to choose one checkpoint that expressed their True North, or name a next checkpoint from a logbook intention. | Does the review reconnect the week to a personal goal? |
| Leave room in the week | Let the user reserve a discretionary buffer or mark time intentionally unplanned. | Does the weekly estimate feel realistic without pressure to fill it? |
| Quest choices that fit a free block | Offer active quests for a block the user selects. Scheduling remains their choice. | Does this make it easier to choose a manageable next action? |
| Private quest time budgets | Compare an optional weekly intention with aggregated confirmed minutes. | Does a rough estimate help people adjust their commitments? |
| Resume a quest from the logbook | Link a past reflection to its paused quest. | Does an old entry help someone return to a thread on their own terms? |
| Chapter review | Show the first and most recent checkpoints together at chapter close. | Can the user describe a change they would otherwise miss? |
| Recurring work hours | Explore weekday work schedules and exceptions for people whose calendars omit working time. | Do waking hours and imported events adequately explain available time? |

## Iteration 5 — Weekly calendar reflection

The weekly review asks how much of the open time on the calendar felt usable. It shows only completed days in the review’s date range, using the profile timezone, waking hours and the existing calculation for overlapping events. The prompt appears when all connected calendars have synced in the last 48 hours. The regular review can be completed if calendar data is unavailable.

An optional next checkpoint idea goes into the existing weekly logbook note as an intention. The calendar reflection displays the free-time total and the dates it covers.

This iteration branches from `main` and can be reviewed and merged independently of the suggestion controls in PR #2. It uses the existing calendar tables and adds no migration.
