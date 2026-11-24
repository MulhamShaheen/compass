import { addDays, dateToLocalInput, dayKey, daysBetween, localInputToDate, weekStart, type DayKey } from "../time";

interface BusyEvent {
  start: string;
  end: string;
}

interface TimeOptions {
  now: Date;
  tz: string;
  wakingStart?: string;
  wakingEnd?: string;
  /** Earliest instant covered by all connected calendars. */
  coverageStart?: string;
}

export interface CalendarDay {
  day: DayKey;
  awakeMinutes: number;
  busyMinutes: number;
  freeMinutes: number;
}

const MINUTE = 60_000;
type Interval = [start: number, end: number];

function boundary(day: DayKey, clock: string, tz: string): number {
  const wall = day + "T" + clock;
  const instant = localInputToDate(wall, tz);
  const actual = dateToLocalInput(instant, tz);
  // date-fns-tz places a missing spring-forward time before the gap.
  // Shift it forward by the gap, e.g. 02:30 becomes 03:30.
  return instant.getTime() + (actual < wall ? Date.parse(wall + "Z") - Date.parse(actual + "Z") : 0);
}

function instant(value: string, tz: string): number {
  // A date-only end is exclusive, including for a multi-day all-day event.
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? boundary(value, "00:00", tz) : Date.parse(value);
}

function mergedIntervals(events: readonly BusyEvent[], tz: string): Interval[] {
  const sorted = events
    .map(({ start, end }): Interval => [instant(start, tz), instant(end, tz)])
    .filter(([start, end]) => end > start)
    .sort(([first], [second]) => first - second);
  const merged: Interval[] = [];
  for (const interval of sorted) {
    const last = merged.at(-1);
    if (last && interval[0] <= last[1]) last[1] = Math.max(last[1], interval[1]);
    else merged.push(interval);
  }
  return merged;
}

/** Waking time minus the union of busy events, grouped by local calendar day. */
export function calendarWeek(events: readonly BusyEvent[], opts: TimeOptions) {
  const monday = weekStart(dayKey(opts.now, opts.tz));
  const first = addDays(monday, -28);
  const start = (opts.wakingStart ?? "07:00").slice(0, 5);
  const end = (opts.wakingEnd ?? "23:00").slice(0, 5);
  const intervals = mergedIntervals(events, opts.tz);
  const days: CalendarDay[] = [];
  let previousFree = 0;
  let cursor = 0;
  for (let i = 0; i < 35; i++) {
    const day = addDays(first, i);
    const wake = boundary(day, start, opts.tz);
    const sleep = boundary(day, end, opts.tz);
    // A night shift has two waking intervals on each civil date.
    const windows: Interval[] = start < end ? [[wake, sleep]] : [
      [boundary(day, "00:00", opts.tz), sleep],
      [wake, boundary(addDays(day, 1), "00:00", opts.tz)],
    ];
    let awake = 0;
    let busy = 0;
    for (const [from, to] of windows) {
      if (from >= to) continue;
      awake += to - from;
      while (cursor < intervals.length && intervals[cursor][1] <= from) cursor++;
      for (let j = cursor; j < intervals.length && intervals[j][0] < to; j++) {
        const [left, right] = intervals[j];
        busy += Math.min(to, right) - Math.max(from, left);
      }
    }
    const freeMinutes = (awake - busy) / MINUTE;
    if (i < 28) previousFree += freeMinutes;
    else days.push({ day, awakeMinutes: awake / MINUTE, busyMinutes: busy / MINUTE, freeMinutes });
  }
  const hasHistory = !opts.coverageStart || instant(opts.coverageStart, opts.tz) <= boundary(first, "00:00", opts.tz);
  return {
    weekStart: monday,
    days,
    freeMinutes: days.reduce((sum, d) => sum + d.freeMinutes, 0),
    busyMinutes: days.reduce((sum, d) => sum + d.busyMinutes, 0),
    averageFreeMinutes: hasHistory ? previousFree / 4 : null,
  };
}

/** A review looks back at completed local days using recently synced calendars. */
export function reviewCalendarTime(
  events: readonly BusyEvent[],
  opts: Omit<TimeOptions, "coverageStart"> & { week: DayKey; lastSyncs: readonly (string | null)[] },
) {
  const completedDays = Math.min(7, daysBetween(opts.week, dayKey(opts.now, opts.tz)));
  const oldestSync = opts.now.getTime() - 48 * 60 * MINUTE;
  if (completedDays <= 0 || !opts.lastSyncs.length ||
      !opts.lastSyncs.every((time) => Date.parse(time ?? "") >= oldestSync)) return null;

  const week = calendarWeek(events, { ...opts, now: localInputToDate(opts.week + "T12:00", opts.tz) });
  return {
    through: addDays(opts.week, completedDays - 1),
    freeMinutes: week.days.slice(0, completedDays).reduce((sum, day) => sum + day.freeMinutes, 0),
  };
}
