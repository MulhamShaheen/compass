import { EventCard, EventForm, type EventQuest } from "@/components/events/EventForms";
import { GoogleEventPublishing, GooglePublishingConnection } from "@/components/events/GooglePublishing";
import { appNow, timezone } from "@/lib/db/derive";
import { loadDbOrLogin } from "@/lib/db/store";
import { googlePublishingView } from "@/lib/events/google-store";
import { eventPoints } from "@/lib/game/points";
import { dateToLocalInput, dayKey, formatDay, formatTime } from "@/lib/time";

export default async function EventsPage({ searchParams }: {
  searchParams: Promise<{ quest?: string | string[]; checkpoint?: string | string[]; google?: string | string[] }>;
}) {
  const [db, params] = await Promise.all([loadDbOrLogin(), searchParams]);
  const publishing = await googlePublishingView();
  const publishedIds = new Set(publishing.publishedIds);
  const tz = timezone(db);
  const now = appNow(db);
  const today = dayKey(now, tz);
  const dateTime = (date: Date) => `${formatDay(dayKey(date, tz), today)} · ${formatTime(date, tz)}`;
  const quests: EventQuest[] = db.quests.filter((quest) => quest.type !== "system").map((quest) => ({
    id: quest.id,
    title: quest.title,
    checkpoints: db.checkpoints
      .filter((checkpoint) => checkpoint.questId === quest.id && checkpoint.source !== "system")
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .map((checkpoint) => ({ id: checkpoint.id, label: `${checkpoint.title} · ${formatDay(dayKey(new Date(checkpoint.occurredAt), tz), today)}` })),
  }));
  const initialQuest = quests.find((quest) => quest.id === params.quest);
  const initialCheckpoint = initialQuest?.checkpoints.find((checkpoint) => checkpoint.id === params.checkpoint);
  const events = [...db.events].sort((a, b) => {
    if (!!a.completedAt !== !!b.completedAt) return a.completedAt ? 1 : -1;
    return a.completedAt ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt);
  });

  return (
    <main className="event-page">
      <section className="panel" aria-labelledby="events-heading">
        <div className="panel-h">
          <h2 id="events-heading">Events</h2>
          <div className="actions">
            <a className="btn" href="#add-event">Add event</a>
            {events.length > 0 && <a className="btn ghost" href="/api/events/ics" download>Download calendar file</a>}
          </div>
        </div>
        <p className="insight">Plan time for a quest or add a standalone event. Complete an event to earn points.</p>
        {events.length ? (
          <ul className="event-list">
            {events.map((event) => {
              const start = new Date(event.startsAt);
              const end = new Date(event.endsAt);
              const schedule = dayKey(start, tz) === dayKey(end, tz)
                ? `${dateTime(start)}–${formatTime(end, tz)}`
                : `${dateTime(start)} to ${dateTime(end)}`;
              const published = publishedIds.has(event.id);
              return (
                <EventCard key={event.id} event={event} quests={quests} timezone={tz} schedule={schedule}
                  started={start <= now} points={eventPoints(event)} published={published}
                  googleControls={publishing.connected ? <GoogleEventPublishing id={event.id} published={published} /> : undefined} />
              );
            })}
          </ul>
        ) : <p className="empty">Your events will appear here.</p>}
      </section>
      <section className="panel" id="add-event" tabIndex={-1} aria-labelledby="add-event-heading">
        <div className="panel-h"><h2 id="add-event-heading">Add event</h2></div>
        <EventForm key={`${initialQuest?.id ?? ""}:${initialCheckpoint?.id ?? ""}`} quests={quests} timezone={tz}
          initialStart={dateToLocalInput(now, tz)} initialEnd={dateToLocalInput(new Date(now.getTime() + 60 * 60 * 1000), tz)}
          initialQuestId={initialQuest?.id} initialCheckpointId={initialCheckpoint?.id} />
      </section>
      <GooglePublishingConnection view={publishing} status={typeof params.google === "string" ? params.google : undefined} />
    </main>
  );
}
