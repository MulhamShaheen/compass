# Compass: Product Spec

> Life is one long storyline. Compass is the window onto it.

Compass is a personal, gamified life dashboard. You follow the threads of your life as **quests**, log progress as dated **checkpoints**, and see which parts of your life (Body, Mind, Bonds, Craft, Spirit) are getting your time. It is also a diary and reflection system, and it should be a joy to open every day.

The clickable prototype is in [`prototype/compass.html`](prototype/compass.html). Open it in a browser. It is the visual and behavioural reference for v1.

---

## 1. Principles

1. **Threads, not tasks.** A quest is a story that can run for months. Checking boxes is not the point. Noticing and recording progress is.
2. **Honest mirror.** The numbers come from what you actually logged. There is no punishment, no streak shaming, and no fake urgency.
3. **Calm by default.** You start with very little on screen and unlock more as you play. Empty is fine.
4. **Reflection is a first-class action.** Writing in the logbook matters as much as finishing things.
5. **Private.** This is a diary. Data belongs to the user, can be exported, and is never shared.

## 2. Core concepts

| Concept | What it is | Notes |
|---|---|---|
| **Character** | The user. Has a name, a level and five attributes. | Level comes from total points. |
| **True North** | One sentence of purpose. | Editable any time. Shown in the header. |
| **Chapter** | A season of life with a title, such as "Chapter 3 · The Builder's Year". | Has a start and end. Closing it triggers a chapter review (post-MVP). |
| **Attribute** | Body, Mind, Bonds, Craft, Spirit. Fixed set in v1. | Has points and a level (every 150 pts). |
| **Quest** | A long-running thread. Type: `main` or `side`. Status: `active`, `paused` or `done`. | Links to 1 primary attribute and an optional secondary one. Has a "why". |
| **Checkpoint** | A dated entry inside a quest: title, commentary, date and time, time spent, milestone flag. | The only source of attribute points. |
| **Habit** | Something to keep (good) or starve (bad), ticked per day. | Shows a 7-day strip and a streak. Earns no points in v1. |
| **Inner weather** | Daily mood check-in: Clear, Breezy, Cloudy, Foggy or Stormy. | One per day, can be changed. |
| **Logbook entry** | A diary entry answering one reflective prompt. | Prompts rotate and are user-editable later. |
| **Today loop** | Three daily steps: check in, move a thread, write in the logbook. | Derived from the day's activity, not stored as tasks. |

### Points rules (v1)

- A checkpoint earns **1 point per 6 minutes** spent (10 per hour).
- A **milestone** adds **+25**.
- A checkpoint with no time logged earns **2 points**.
- A quest with two attributes splits points **70% primary / 30% secondary**.
- Attribute level = `floor(points / 150) + 1`. Character level = `floor(totalPoints / 400) + 1`.
- Points are **always computed from checkpoints**, never stored as a running total. Editing or deleting a checkpoint recomputes them.

### Views

- **The map (dashboard):** header (True North, chapter, level) · Character · Where life goes · Quest threads · Today and inner weather · Habits · Logbook.
- **Quest thread:** header, stats (started, days running, checkpoints, time, points), the "log a checkpoint" form, and the timeline from newest to oldest, with milestones marked and the gap in days between entries.
- **Where life goes:** hours per attribute over 30 days, 90 days or all time, a one-line insight, and a 12-week stacked chart.

---

## 3. Onboarding: "The Prologue"

**The problem:** a blank dashboard with eight sections is overwhelming. Asking for everything up front leads people to quit.

**The answer:** onboarding is itself a quest. The user plays a short **Prologue** (about 5 minutes) on day one, then **unlocks sections over the first week**. Each unlock is a checkpoint in a special system quest called *Prologue*, so the user can later read the story of how they started.

### 3.1 Day 0: the Prologue (5 short screens)

One question per screen, a large serif prompt, and a "Skip for now" on everything except step 4.

1. **Who are you?** A name for your character. Optionally pick a chapter title from suggestions ("The Builder's Year", "Starting Over", "The Long Climb") or write your own.
2. **Where are you heading?** Your True North. Show 3 example sentences. Skipping sets a placeholder: "I'll write this when I know".
3. **Where do you stand?** Rate how satisfied you are with each attribute today on a 1 to 5 scale, with one line explaining each attribute. This is a **baseline**, shown later as "how you felt at the start". It is not points.
4. **Your first quest.** Pick one **main quest**. Offer templates per attribute (for example "Run a 10K", "Read 12 books", "Call family weekly", "Ship a side project", "Start meditating") or a free-text option. Then the "why", then attributes. The app adds the first checkpoint automatically: *"The quest begins"*, with an optional note "where I stand today".
5. **How's the weather?** The first inner weather check-in. It ends on the map, with a short "Your story starts today" moment.

After the Prologue, the map shows only: **header, Today, the one quest, the logbook.** Everything else shows as a quiet locked card with a single line saying when it opens.

### 3.2 Progressive unlocks (first week)

Each unlock is triggered by **play, not by time**, with a time fallback so nobody gets stuck.

| Unlocks | Trigger (first to happen) | Copy on unlock |
|---|---|---|
| **Logbook prompts rotate** | After the first logbook entry | "Another question will wait for you tomorrow." |
| **Habits** (max 1 keep + 1 starve at first) | 2 days with a check-in, or day 3 | "Small things, done daily. Pick one to keep and one to starve." |
| **Side quests** | 3 checkpoints logged, or day 4 | "Not every thread is the main story." |
| **Character panel** (attribute levels) | First 50 points | "Your attributes are waking up." |
| **Where life goes** | 5 checkpoints across 2+ quests, or day 7 | "Here's where your time went." |
| **Weekly review** | Day 7 | Guided 3-step review (see 3.4) |
| **Calendar connect** | After the first weekly review | "Want Compass to see your busy and free time?" |

### 3.3 Guard rails against overwhelm

- **Quest slots.** Start with **1 main + 3 side** active quests. You gain +1 side slot at character levels 3, 5 and 8. Pausing a quest frees a slot. This works as a game mechanic that keeps focus.
- **Habit slots.** Start with 2. +1 per weekly review completed, up to 6.
- **Gentle empty states.** Every empty section says one sentence about what it is for and shows one button.
- **No red counters.** Missed days show as empty squares, never as warnings.
- **"Quiet mode" toggle.** Hides Character and Where life goes, so only Today, quests and the logbook remain.

### 3.4 Rituals after onboarding

- **Daily (2 minutes):** check in on the weather, move one thread, answer one question.
- **Weekly review (5 minutes):** (1) look at where life went this week against your True North, (2) choose quests to pause, resume or begin, (3) write one logbook entry: "What will next week be about?"
- **Chapter close (post-MVP):** write a summary, see the chapter in numbers, and name the next chapter.

---

## 4. Calendar and future metrics

**Yes, a calendar fits naturally.** Its job is to answer "how much free time do I really have, and where does my busy time go?"

### 4.1 Calendar v1 (read-only)

- **Sources:**
  - Google Calendar through OAuth (`calendar.readonly`).
  - Any **ICS subscription URL**. This covers iCloud/Apple Calendar (Share Calendar → Public), Outlook, and others with no OAuth needed.
- **Free-time model:** the user sets "waking hours" (for example 07:00 to 23:00) and work hours. **Free time = waking hours − busy events**, per day and per week.
- **New panel, "Time":** a week strip showing busy versus free hours per day, and a "Free hours this week" figure with its trend against the last 4 weeks.
- **Tag events to attributes or quests.** Rules like "events containing *gym* → Body" or "events with *Grandma* → quest: Stay close to grandmother". Tagged events **suggest** a checkpoint ("You had *Gym* for 1h. Log it on *Run a 10K*?"). The user confirms. Nothing is logged silently.
- Calendar time that has been tagged and confirmed feeds **Where life goes** like any checkpoint.

### 4.2 Future metrics (post-MVP, same pattern)

Each source is a read-only **signal** that can suggest checkpoints or show as a resource bar.

- **Sleep, steps, workouts:** Apple Health through an iOS Shortcut that posts to a Compass webhook, or a native app later.
- **Screen time:** manual weekly entry at first.
- **Money runway:** manual monthly entry.
- **Energy and social battery:** quick sliders in the daily check-in (these were the "Resources" panel in prototype v1).
- **Issues and debuffs:** worries or blockers attached to quests (from prototype v1, deferred).
- **Weather × time correlations:** "Your Clear days follow days with Body checkpoints."

---

## 5. MVP scope

**In:**
- Account and auth.
- The Prologue onboarding and progressive unlocks.
- Quests and checkpoints, including editing and deleting.
- Attributes and points, character level.
- Where life goes (30 days, 90 days, all time, and the 12-week chart).
- Habits with the 7-day strip.
- Inner weather.
- Logbook with rotating prompts.
- Weekly review.
- Phone-friendly installable web app (PWA), light and dark theme.
- JSON export.

**Next (v1.1):** calendar (ICS first, then Google), event-tagging rules, the Time panel, editable prompts, quiet mode.

**Later:** chapters and chapter review, resources, issues, Apple Health signals, Claude as a companion that reads the logbook and suggests next moves, native mobile app.

**Out:** social features and sharing, public leaderboards, notifications beyond one optional daily reminder.
