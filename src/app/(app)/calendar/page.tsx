import Link from "next/link";
import { LockedCard } from "@/components/bits";
import { formatInTimeZone } from "date-fns-tz";
import { ConnectSource, SourceControls, Suggestion, TaggingRules, WakingHours } from "@/components/calendar/CalendarForms";
import { calendarStore } from "@/lib/calendar/store";
import { suggestedCheckpoints } from "@/lib/calendar/suggestions";
import { loadDbOrLogin } from "@/lib/db/store";
import { canConnectCalendar, timezone } from "@/lib/db/derive";
import { calendarWeek } from "@/lib/game/time";
import { isLocalMode } from "@/lib/supabase/env";
import { addDays, formatDay } from "@/lib/time";

export const dynamic = "force-dynamic";

const googleStatus = {
  connected: "Google Calendar connected.",
  pending: "Google Calendar connected. Use Sync to try importing events again.",
  denied: "Google Calendar connection cancelled.",
  unavailable: "Google Calendar is unavailable here.",
  failed: "Google Calendar could not connect. Try connecting again.",
};

const DAY_MS = 86_400_000;

function duration(minutes: number) {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (hours === 0) return `${remainder}m`;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function Week({ week, timezone }: { week: ReturnType<typeof calendarWeek>; timezone: string }) {
  const lastDay = addDays(week.weekStart, 6);
  return (
    <>
      <p className="label">{formatDay(week.weekStart, lastDay)} – {formatDay(lastDay, lastDay)} · {timezone}</p>
      <div className="calendar-total"><strong>{duration(week.freeMinutes)}</strong> free this week</div>
      {week.averageFreeMinutes !== null
        ? <p className="insight">Previous four weeks averaged {duration(week.averageFreeMinutes)} free per week.</p>
        : <p className="insight">A comparison appears when the calendar covers four previous weeks.</p>}
      <table className="calendar-week">
        <caption className="sr-only">Daily busy and free waking time</caption>
        <thead><tr><th scope="col" colSpan={2}>Day</th><th scope="col">Busy</th><th scope="col">Free</th></tr></thead>
        <tbody>{week.days.map((day) => (
          <tr key={day.day}>
            <th scope="row">{formatInTimeZone(new Date(day.day + "T12:00:00Z"), "UTC", "EEE d")}</th>
            <td aria-hidden="true"><div className="calendar-meter"><i style={{ width: `${day.awakeMinutes ? 100 * day.busyMinutes / day.awakeMinutes : 0}%` }} /></div></td>
            <td>{duration(day.busyMinutes)}</td>
            <td>{duration(day.freeMinutes)}</td>
          </tr>
        ))}</tbody>
      </table>
    </>
  );
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ google?: string; page?: string }> }) {
  const db = await loadDbOrLogin();
  if (!canConnectCalendar(db)) {
    return <main><LockedCard title="Time" hint="Opens after your first weekly review." /></main>;
  }
  const calendar = await (await calendarStore()).load();
  const { google, page } = await searchParams;
  const tz = timezone(db);
  const now = new Date();
  const quests = db.quests.filter((quest) => quest.type !== "system" && quest.status === "active");
  const option = ({ id, title }: { id: string; title: string }) => ({ id, title });
  const hidden = new Set([...calendar.confirmedIds, ...(calendar.dismissedIds ?? [])]);
  const suggestions = suggestedCheckpoints(calendar.events, calendar.rules, quests, now, hidden);
  const pageCount = Math.max(1, Math.ceil(suggestions.length / 10));
  const currentPage = Math.min(pageCount, Math.max(1, Math.floor(Number(page)) || 1));
  const syncTimes = calendar.sources.map((source) => Date.parse(source.lastSyncedAt ?? ""));
  const oldestSync = Math.min(...syncTimes);
  const newestSync = Math.max(...syncTimes);
  const syncAge = now.getTime() - oldestSync;
  const ready = syncTimes.length > 0 && Number.isFinite(syncAge) && syncAge < 23 * DAY_MS;
  const week = ready ? calendarWeek(calendar.events, {
    now,
    tz,
    wakingStart: calendar.wakingStart,
    wakingEnd: calendar.wakingEnd,
    coverageStart: new Date(newestSync - 35 * DAY_MS + 60_000).toISOString(),
  }) : null;
  const googleEnabled = !isLocalMode() && Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const dateTime = (iso: string) => formatInTimeZone(iso, tz, "d MMM, HH:mm");
  const status = google && Object.prototype.hasOwnProperty.call(googleStatus, google) ? googleStatus[google as keyof typeof googleStatus] : null;

  return (
    <main className="calendar-page">
      {status && <p role="status" className="nudge">{status}</p>}
      <section className="panel">
        <div className="panel-h"><h2>Time</h2></div>
        {week && syncAge > DAY_MS && <p className="insight">Showing imported events. Some calendars last synced over a day ago. <a className="link" href="#calendars">Manage calendars</a></p>}
        {week
          ? <Week week={week} timezone={tz} />
          : <p className="empty">{calendar.sources.length ? "Sync your calendars to see this week’s free time." : "Connect a calendar to see where your week has room."} <a className="link" href="#calendars">Manage calendars</a></p>}
      </section>
      <section className="panel" id="suggestions">
        <div className="panel-h"><h2>Suggested checkpoints</h2></div>
        {suggestions.length ? <ul className="calendar-list">
          {suggestions.slice((currentPage - 1) * 10, currentPage * 10).map(({ event, matches }) => <Suggestion
            key={event.id} eventId={event.id} title={event.title}
            quests={matches.map(({ quest }) => option(quest))}
            rules={[...new Map(matches.flatMap(({ rules }) => rules.map((rule) => [rule.id, rule] as const))).values()]}
            canDismiss={calendar.dismissedIds !== null}
            detail={`${dateTime(event.start)} · ${duration((Date.parse(event.end) - Date.parse(event.start)) / 60000)}`}
          />)}
        </ul> : <p className="empty">{calendar.rules.length ? "Past events that match a rule and an active quest appear here." : "Add an event rule below to suggest checkpoints for your active quests."}</p>}
        {pageCount > 1 && <nav className="calendar-buttons" aria-label="Suggested checkpoint pages">
          {currentPage > 1 && <Link className="link" href={`/calendar?page=${currentPage - 1}#suggestions`}>Previous</Link>}
          <span>Page {currentPage} of {pageCount}</span>
          {currentPage < pageCount && <Link className="link" href={`/calendar?page=${currentPage + 1}#suggestions`}>Next</Link>}
        </nav>}
      </section>
      <section className="panel" id="calendars">
        <div className="panel-h"><h2>Calendars</h2></div>
        {calendar.sources.length > 0 && <ul className="calendar-list">{calendar.sources.map((source) => (
          <SourceControls key={source.id} source={source} lastSync={source.lastSyncedAt && dateTime(source.lastSyncedAt)} />
        ))}</ul>}
        <ConnectSource googleEnabled={googleEnabled} />
      </section>
      <section className="panel">
        <div className="panel-h"><h2>Waking hours</h2></div>
        <WakingHours start={calendar.wakingStart} end={calendar.wakingEnd} timezone={tz} />
      </section>
      <section className="panel">
        <div className="panel-h"><h2>Event tagging</h2></div>
        <TaggingRules rules={calendar.rules} quests={quests.map(option)} />
      </section>
    </main>
  );
}
