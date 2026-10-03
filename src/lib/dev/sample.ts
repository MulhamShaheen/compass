import { FEATURES } from "../game/unlocks";
import type { Attribute, Weather } from "../game/types";
import { addDays, dayKey, localInputToDate, weekStart } from "../time";
import { emptyDb, type Checkpoint, type Db, type Quest } from "../db/schema";

/**
 * The prototype's example character (docs/prototype/compass.html), with every
 * date expressed relative to `now`. Used by the "Load sample" dev tool and by
 * the unit tests, which assert the same numbers the prototype shows.
 */

type Cp = [daysAgo: number, hour: number, minute: number, title: string, note: string, minutes: number, milestone?: boolean];
type QuestSeed = {
  type: "main" | "side";
  attrs: [Attribute] | [Attribute, Attribute];
  title: string;
  why: string;
  startDaysAgo: number;
  status: "active" | "done";
  cps: Cp[];
};

export const SAMPLE_QUESTS: QuestSeed[] = [
  {
    type: "main", attrs: ["craft", "mind"], title: "Launch Compass",
    why: "Turn my own way of living into a tool others can use.", startDaysAgo: 40, status: "active",
    cps: [
      [40, 23, 10, "The idea lands", "Wrote the first page about life as a storyline. Felt more like a confession than a plan.", 30],
      [33, 21, 0, "Sketched quests and attributes", "Body, Mind, Bonds, Craft, Spirit. Five feels right; more would turn into bookkeeping.", 60],
      [19, 19, 30, "Looked at other habit apps", "Most are checklists with confetti. None let a goal be a story that lasts months.", 90],
      [9, 22, 0, "Concept written", "Quests, habits, logbook, inner weather. Clear enough to show someone.", 120, true],
      [0, 22, 40, "Prototype v2 feedback", "Quests must be threads with checkpoints, not to-do lists. Keep the logbook, weather and habits.", 60],
    ],
  },
  {
    type: "main", attrs: ["body", "spirit"], title: "Run a 10K",
    why: "Feel strong again, and prove I can finish something physical.", startDaysAgo: 84, status: "active",
    cps: [
      [84, 7, 15, "First run in two years", "2.5 km and I had to walk twice. Embarrassing, but I went.", 30],
      [70, 7, 0, "Two weeks of three runs a week", "Legs adapting. Mornings feel calmer on running days.", 180],
      [56, 7, 30, "5K without stopping", "Didn't think it would come this early. Pace 6:40.", 45, true],
      [42, 20, 0, "Shin pain, resting a week", "Annoying. Swapping runs for walks and stretching.", 0],
      [28, 7, 0, "Back on the road", "Started slower. No pain so far.", 120],
      [12, 8, 0, "8K long run", "Last kilometre was pure stubbornness.", 60, true],
      [3, 7, 10, "Four runs this week", "Race is close. Sleep is the weak point now.", 210],
    ],
  },
  {
    type: "side", attrs: ["bonds"], title: "Stay close to grandmother",
    why: "She will not be here forever.", startDaysAgo: 110, status: "active",
    cps: [
      [105, 18, 0, "Long Sunday call", "She told the story of the house again. I recorded part of it this time.", 60],
      [77, 12, 0, "Visited for the weekend", "Cooked together. She corrected my spices, as always.", 480, true],
      [49, 18, 30, "Sunday call", "Short. She was tired. Need to call more often, not longer.", 30],
      [21, 18, 0, "Sunday call", "She asked about the running. Proud in her quiet way.", 45],
      [6, 17, 45, "Sunday call", "Planned the next visit for November.", 60],
    ],
  },
  {
    type: "side", attrs: ["mind"], title: "Read 12 books this year",
    why: "Keep the mind fed with more than feeds.", startDaysAgo: 100, status: "active",
    cps: [
      [95, 22, 0, "Finished 'Atomic Habits'", "Identity first, habits second. Fits this whole project.", 240, true],
      [60, 22, 30, "Halfway through 'The Pragmatic Programmer'", "Slow, but every chapter gives me one thing to try.", 300],
      [30, 21, 0, "Finished 'The Pragmatic Programmer'", "Wrote a one-page summary.", 180, true],
      [8, 23, 0, "Started 'Man's Search for Meaning'", "Heavy. Reading it in small doses.", 120],
    ],
  },
  {
    type: "side", attrs: ["bonds", "spirit"], title: "Weekend trip with friends",
    why: "We keep saying 'someday'.", startDaysAgo: 15, status: "active",
    cps: [
      [15, 21, 0, "Proposed it in the group chat", "Three replies with thumbs up. That counts as a yes.", 0],
      [5, 20, 0, "Picked a date", "Second weekend of November. Looking at places by the sea.", 30],
    ],
  },
  {
    type: "side", attrs: ["craft", "bonds"], title: "Set up the new flat",
    why: "A home, not a place to sleep.", startDaysAgo: 118, status: "done",
    cps: [
      [118, 10, 0, "Moving day", "Friends helped carry everything. Pizza on the floor.", 480],
      [112, 11, 0, "Built the desk and shelves", "The flat finally feels like mine.", 240, true],
    ],
  },
];

const SAMPLE_HABITS: { kind: "keep" | "starve"; name: string; daysAgo: number[] }[] = [
  { kind: "keep", name: "Morning walk", daysAgo: [1, 2, 3, 5, 6] },
  { kind: "keep", name: "Read 20 pages", daysAgo: [1, 2, 4] },
  { kind: "keep", name: "No phone in bed", daysAgo: [2, 3] },
  { kind: "starve", name: "Doomscrolling", daysAgo: [1, 4] },
  { kind: "starve", name: "Sleeping after 1am", daysAgo: [3, 5] },
];

const pad = (n: number) => String(n).padStart(2, "0");

export function buildSample(now: Date, tz: string): Db {
  const today = dayKey(now, tz);
  const ago = (n: number) => addDays(today, -n);
  const at = (n: number, h: number, m: number) => localInputToDate(`${ago(n)}T${pad(h)}:${pad(m)}`, tz).toISOString();
  const start = at(120, 20, 0);
  const db = emptyDb();
  let seq = 0;
  const id = (prefix: string) => `${prefix}-${++seq}`;

  db.profile = {
    characterName: "Sam",
    trueNorth: "Build things that matter, stay close to the people I love, and keep my body strong enough to enjoy it.",
    timezone: tz,
    quietMode: false,
    prologueCompletedAt: start,
    createdAt: start,
  };
  const chapterId = id("chapter");
  db.chapters.push({ id: chapterId, title: "Chapter 3 · The Builder's Year", startedOn: ago(120), endedOn: null });

  const prologue: Quest = {
    id: id("quest"), chapterId, type: "system", status: "done", title: "Prologue",
    why: "How the story started.", primaryAttr: "spirit", secondaryAttr: null,
    startedOn: ago(120), completedAt: start, createdAt: start,
  };
  db.quests.push(prologue);
  db.checkpoints.push({
    id: id("cp"), questId: prologue.id, occurredAt: start, title: "The story begins", note: null,
    minutes: 0, isMilestone: true, source: "system", createdAt: start,
  });

  for (const seed of SAMPLE_QUESTS) {
    const created = at(seed.startDaysAgo, 9, 0);
    const quest: Quest = {
      id: id("quest"), chapterId, type: seed.type, status: seed.status, title: seed.title, why: seed.why,
      primaryAttr: seed.attrs[0], secondaryAttr: seed.attrs[1] ?? null, startedOn: ago(seed.startDaysAgo),
      completedAt: seed.status === "done" ? at(seed.cps[seed.cps.length - 1][0], 12, 0) : null, createdAt: created,
    };
    db.quests.push(quest);
    for (const [n, h, m, title, note, minutes, ms] of seed.cps) {
      const cp: Checkpoint = {
        id: id("cp"), questId: quest.id, occurredAt: at(n, h, m), title, note, minutes,
        isMilestone: !!ms, source: "manual", createdAt: at(n, h, m),
      };
      db.checkpoints.push(cp);
    }
  }

  for (const h of SAMPLE_HABITS) {
    const habitId = id("habit");
    db.habits.push({ id: habitId, name: h.name, kind: h.kind, archivedAt: null, createdAt: start });
    for (const n of h.daysAgo) db.habitLogs.push({ habitId, day: ago(n) });
  }

  const weather: Weather = "cloudy";
  db.weather.push({ day: ago(1), weather });
  db.journal.push(
    {
      id: id("entry"), day: ago(1), prompt: "What drained you, and what fed you?", weather: "cloudy",
      body: "Long day of meetings drained me. The evening run fed me more than I expected. Want to protect that hour.",
      createdAt: at(1, 22, 0),
    },
    {
      id: id("entry"), day: ago(3), prompt: "What small thing went better than expected?", weather: "clear",
      body: "Finished the concept for Compass. Seeing my life as quests already makes the week feel lighter.",
      createdAt: at(3, 22, 0),
    },
  );

  // Three past weekly reviews, so the five sample habits fit their slots.
  for (const n of [21, 14, 7]) {
    db.reviews.push({ id: id("review"), weekStart: weekStart(ago(n)), note: null, completedAt: at(n, 20, 0) });
  }

  for (const feature of FEATURES) {
    if (feature === "calendar") continue;
    db.unlocks.push({ feature, unlockedAt: start, seenAt: start });
  }
  return db;
}
