import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/**
 * Day keys are plain "YYYY-MM-DD" strings in the user's timezone.
 * Arithmetic on them is done in UTC so it is never affected by DST.
 */
export type DayKey = string;

const DAY_MS = 86_400_000;

export function dayKey(date: Date, tz: string): DayKey {
  return formatInTimeZone(date, tz, "yyyy-MM-dd");
}

function keyToUtc(day: DayKey): number {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcToKey(ms: number): DayKey {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(day: DayKey, n: number): DayKey {
  return utcToKey(keyToUtc(day) + n * DAY_MS);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((keyToUtc(b) - keyToUtc(a)) / DAY_MS);
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(day: DayKey): number {
  return (new Date(keyToUtc(day)).getUTCDay() + 6) % 7;
}

/** Monday of the week containing `day`. Weeks start on Monday. */
export function weekStart(day: DayKey): DayKey {
  return addDays(day, -weekdayIndex(day));
}

/** Parse a `datetime-local` value ("YYYY-MM-DDTHH:mm") entered in `tz` into a UTC Date. */
export function localInputToDate(value: string, tz: string): Date {
  return fromZonedTime(value, tz);
}

/** Format a Date as a `datetime-local` value in `tz`. */
export function dateToLocalInput(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, "yyyy-MM-dd'T'HH:mm");
}

export function formatDay(day: DayKey, today: DayKey): string {
  const d = new Date(keyToUtc(day));
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  return formatInTimeZone(d, "UTC", sameYear ? "d MMM" : "d MMM yyyy");
}

export function formatTime(date: Date, tz: string): string {
  return formatInTimeZone(date, tz, "HH:mm");
}

export function formatToday(day: DayKey): string {
  return formatInTimeZone(new Date(keyToUtc(day)), "UTC", "EEE d MMM");
}

export function relativeDay(day: DayKey, today: DayKey): string {
  const d = daysBetween(day, today);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  if (d < 60) return `${Math.round(d / 7)} weeks ago`;
  return `${Math.round(d / 30)} months ago`;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
