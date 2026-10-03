import "server-only";
import {
  ATTRIBUTES,
  ATTRIBUTE_NAMES,
  attributeLevel,
  attributeTotals,
  characterLevel,
  checkpointPoints,
  cleanDays,
  dayNumber,
  DEFAULT_PROMPTS,
  FEATURES,
  gapLabel,
  habitSlots,
  habitStreak,
  insight,
  last7,
  lockedHint,
  promptIndex,
  questPulse,
  questSlots,
  questStats,
  rangeTotals,
  shareRows,
  shouldPromptReview,
  splitByAttributes,
  todayLoop,
  totalPoints,
  UNLOCK_COPY,
  weeklyHours,
  type Attribute,
  type Feature,
  type LevelInfo,
  type QuestStats,
  type ShareRow,
  type TodayLoop,
  type Weather,
} from "./game";
import { appNow, isUnlocked, playableCheckpoints, prologueQuest, timezone, unlockState } from "./db/derive";
import type { Db, Quest } from "./db/schema";
import { dateToLocalInput, dayKey, formatDay, formatTime, formatToday, relativeDay, type DayKey } from "./time";

/**
 * View models for the screens. Every number is computed by src/lib/game;
 * this file only gathers records and formats them in the user's timezone.
 */

export interface HeaderView {
  name: string | null;
  trueNorth: string;
  chapter: string;
  level: LevelInfo;
  total: number;
  todayLabel: string;
  dayNumber: number;
  quietMode: boolean;
  reviewUnlocked: boolean;
  dayOffset: number;
}

export interface QuestRowView {
  id: string;
  title: string;
  type: "main" | "side";
  status: Quest["status"];
  attrs: Attribute[];
  day: number;
  checkpoints: number;
  last: { title: string; rel: string } | null;
  lastAt: string;
  pulse: number[];
}

export interface MapView {
  header: HeaderView;
  unlocked: Record<Feature, boolean>;
  hints: Record<Feature, string>;
  fresh: { feature: Feature; title: string; body: string }[];
  attributes: {
    attr: Attribute;
    points: number;
    level: LevelInfo;
    minutes: number;
    activeQuests: number;
    baseline: number | null;
  }[];
  where: {
    ranges: { key: "30" | "90" | "all"; label: string; rows: ShareRow[]; insight: string }[];
    weeks: { label: string; tipLabel: string; hours: Record<Attribute, number>; total: number }[];
  };
  quests: QuestRowView[];
  prologueId: string | null;
  slots: { main: { used: number; max: number }; side: { used: number; max: number } };
  loop: TodayLoop;
  weather: Weather | null;
  habits: {
    id: string;
    name: string;
    kind: "keep" | "starve";
    doneToday: boolean;
    strip: boolean[];
    streak: number;
    clean: number;
  }[];
  habitSlots: number;
  reviewsCompleted: number;
  journal: {
    prompts: string[];
    startIndex: number;
    rotates: boolean;
    entries: { id: string; day: string; weather: Weather | null; prompt: string | null; body: string }[];
  };
  reviewDue: boolean;
}

function header(db: Db, now: Date): HeaderView {
  const tz = timezone(db);
  const today = dayKey(now, tz);
  const total = totalPoints(attributeTotals(db.quests, db.checkpoints));
  const start = db.profile?.prologueCompletedAt ? dayKey(new Date(db.profile.prologueCompletedAt), tz) : today;
  return {
    name: db.profile?.characterName ?? null,
    trueNorth: db.profile?.trueNorth ?? "",
    chapter: db.chapters.find((c) => !c.endedOn)?.title ?? "",
    level: characterLevel(total),
    total,
    todayLabel: formatToday(today),
    dayNumber: dayNumber(start, today),
    quietMode: db.profile?.quietMode ?? false,
    reviewUnlocked: isUnlocked(db, "weekly_review"),
    dayOffset: db.dev.dayOffset,
  };
}

export function buildHeader(db: Db): HeaderView {
  return header(db, appNow(db));
}

function questRows(db: Db, now: Date): QuestRowView[] {
  const tz = timezone(db);
  const today = dayKey(now, tz);
  return db.quests
    .filter((q): q is Quest & { type: "main" | "side" } => q.type !== "system")
    .map((q) => {
      const cps = db.checkpoints
        .filter((c) => c.questId === q.id)
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
      const last = cps[0];
      return {
        id: q.id,
        title: q.title,
        type: q.type,
        status: q.status,
        attrs: [q.primaryAttr, ...(q.secondaryAttr ? [q.secondaryAttr] : [])],
        day: dayNumber(q.startedOn, today),
        checkpoints: cps.length,
        last: last ? { title: last.title, rel: relativeDay(dayKey(new Date(last.occurredAt), tz), today) } : null,
        lastAt: last?.occurredAt ?? "",
        pulse: questPulse(cps, { now, tz }),
      };
    })
    .sort((a, b) => (a.type === "main" ? 0 : 1) - (b.type === "main" ? 0 : 1) || b.lastAt.localeCompare(a.lastAt));
}

export function buildMap(db: Db): MapView {
  const now = appNow(db);
  const tz = timezone(db);
  const today = dayKey(now, tz);
  const state = unlockState(db, now);
  const unlocked = Object.fromEntries(FEATURES.map((f) => [f, isUnlocked(db, f)])) as Record<Feature, boolean>;
  const hints = Object.fromEntries(FEATURES.map((f) => [f, lockedHint(f, state)])) as Record<Feature, string>;
  const all = attributeTotals(db.quests, db.checkpoints);
  const ranges = rangeTotals(db.quests, db.checkpoints, now);
  const level = characterLevel(totalPoints(all)).level;
  const activeQuests = db.quests.filter((q) => q.type !== "system" && q.status === "active");
  const slots = questSlots(level);

  const baseline = (attr: Attribute) =>
    db.ratings.filter((r) => r.attribute === attr && r.context === "baseline").at(-1)?.rating ?? null;

  const weeks = weeklyHours(db.quests, db.checkpoints, { now, tz });
  // Only checkpoints the user logged move a thread; "The quest begins" is added by the app.
  const cpDays = playableCheckpoints(db)
    .filter((c) => c.source !== "system")
    .flatMap((c) => [dayKey(new Date(c.createdAt), tz), dayKey(new Date(c.occurredAt), tz)]);
  const activeHabits = db.habits.filter((h) => !h.archivedAt);

  return {
    header: header(db, now),
    unlocked,
    hints,
    fresh: db.unlocks
      .filter((u) => !u.seenAt && u.feature !== "calendar")
      .map((u) => ({ feature: u.feature, ...UNLOCK_COPY[u.feature] })),
    attributes: ATTRIBUTES.map((attr) => ({
      attr,
      points: Math.round(all[attr].points),
      level: attributeLevel(all[attr].points),
      minutes: Math.round(all[attr].minutes),
      activeQuests: activeQuests.filter((q) => q.primaryAttr === attr || q.secondaryAttr === attr).length,
      baseline: baseline(attr),
    })),
    where: {
      ranges: [
        { key: "30", label: "30d", rows: shareRows(ranges[30]), insight: insight(ranges[30], 30) },
        { key: "90", label: "90d", rows: shareRows(ranges[90]), insight: insight(ranges[90], 90) },
        { key: "all", label: "All", rows: shareRows(ranges.all), insight: insight(ranges.all, null) },
      ],
      weeks: weeks.map((w, i) => ({
        label: i === weeks.length - 1 ? "now" : formatDay(w.weekStart, today),
        tipLabel: `Week of ${formatDay(w.weekStart, today)}`,
        hours: w.hours,
        total: w.total,
      })),
    },
    quests: questRows(db, now),
    prologueId: prologueQuest(db)?.id ?? null,
    slots: {
      main: { used: activeQuests.filter((q) => q.type === "main").length, max: slots.main },
      side: { used: activeQuests.filter((q) => q.type === "side").length, max: slots.side },
    },
    loop: todayLoop(
      { weatherDays: db.weather.map((w) => w.day), checkpointDays: cpDays, journalDays: db.journal.map((j) => j.day) },
      today,
    ),
    weather: db.weather.find((w) => w.day === today)?.weather ?? null,
    habits: activeHabits.map((h) => {
      const days = db.habitLogs.filter((l) => l.habitId === h.id).map((l) => l.day);
      return {
        id: h.id,
        name: h.name,
        kind: h.kind,
        doneToday: days.includes(today),
        strip: last7(days, today),
        streak: habitStreak(days, today),
        clean: cleanDays(days, today),
      };
    }),
    habitSlots: habitSlots(db.reviews.length),
    reviewsCompleted: db.reviews.length,
    journal: {
      prompts: [...DEFAULT_PROMPTS],
      startIndex: promptIndex(state.startDay, today, unlocked.prompts_rotate),
      rotates: unlocked.prompts_rotate,
      entries: [...db.journal]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((j) => ({ id: j.id, day: formatDay(j.day, today), weather: j.weather, prompt: j.prompt, body: j.body })),
    },
    reviewDue: unlocked.weekly_review && shouldPromptReview(today, db.reviews.map((r) => r.weekStart)),
  };
}

export interface TimelineItem {
  id: string;
  title: string;
  note: string | null;
  minutes: number;
  isMilestone: boolean;
  isSystem: boolean;
  dateLabel: string;
  timeLabel: string;
  rel: string;
  gain: [Attribute, number][];
  gap: string | null;
  localInput: string;
}

export interface ThreadView {
  header: HeaderView;
  quest: {
    id: string;
    title: string;
    why: string | null;
    type: Quest["type"];
    status: Quest["status"];
    attrs: Attribute[];
    primaryAttr: Attribute;
    secondaryAttr: Attribute | null;
  };
  stats: QuestStats & { startedLabel: string };
  timeline: TimelineItem[];
  nowInput: string;
}

export function buildThread(db: Db, id: string): ThreadView | null {
  const quest = db.quests.find((q) => q.id === id);
  if (!quest) return null;
  const now = appNow(db);
  const tz = timezone(db);
  const today = dayKey(now, tz);
  const cps = db.checkpoints
    .filter((c) => c.questId === id)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt));
  const system = quest.type === "system";
  const day = (iso: string): DayKey => dayKey(new Date(iso), tz);
  return {
    header: header(db, now),
    quest: {
      id: quest.id,
      title: quest.title,
      why: quest.why,
      type: quest.type,
      status: quest.status,
      attrs: system ? [] : [quest.primaryAttr, ...(quest.secondaryAttr ? [quest.secondaryAttr] : [])],
      primaryAttr: quest.primaryAttr,
      secondaryAttr: quest.secondaryAttr,
    },
    stats: { ...questStats(quest, system ? [] : cps, today), checkpoints: cps.length, startedLabel: formatDay(quest.startedOn, today) },
    timeline: cps.map((c, i) => {
      const prev = cps[i + 1];
      return {
        id: c.id,
        title: c.title,
        note: c.note,
        minutes: c.minutes,
        isMilestone: c.isMilestone,
        isSystem: system,
        dateLabel: formatDay(day(c.occurredAt), today),
        timeLabel: formatTime(new Date(c.occurredAt), tz),
        rel: relativeDay(day(c.occurredAt), today),
        gain: system ? [] : splitByAttributes(quest, checkpointPoints(c)).map(([a, v]) => [a, Math.round(v)] as [Attribute, number]),
        gap: prev ? gapLabel(day(prev.occurredAt), day(c.occurredAt)) : null,
        localInput: dateToLocalInput(new Date(c.occurredAt), tz),
      };
    }),
    nowInput: dateToLocalInput(now, tz),
  };
}

export interface ReviewView {
  header: HeaderView;
  weekLabel: string;
  alreadyDone: boolean;
  rows: ShareRow[];
  insight: string;
  quests: QuestRowView[];
  slots: MapView["slots"];
  sideUnlocked: boolean;
  baseline: Partial<Record<Attribute, number>>;
}

export function buildReview(db: Db, week: DayKey, weekEndExclusive: DayKey): ReviewView {
  const now = appNow(db);
  const tz = timezone(db);
  const today = dayKey(now, tz);
  const inWeek = db.checkpoints.filter((c) => {
    const d = dayKey(new Date(c.occurredAt), tz);
    return d >= week && d < weekEndExclusive;
  });
  const totals = attributeTotals(db.quests, inWeek);
  const map = buildMap(db);
  const baseline: Partial<Record<Attribute, number>> = {};
  for (const r of db.ratings) baseline[r.attribute] = r.rating;
  return {
    header: map.header,
    weekLabel: `Week of ${formatDay(week, today)}`,
    alreadyDone: db.reviews.some((r) => r.weekStart === week),
    rows: shareRows(totals),
    insight: insight(totals, null).replace("of your time.", "of your time this week."),
    quests: map.quests.filter((q) => q.status !== "done"),
    slots: map.slots,
    sideUnlocked: map.unlocked.side_quests,
    baseline,
  };
}

export { ATTRIBUTE_NAMES };
