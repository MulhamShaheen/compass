import { ShareBars } from "@/components/map/WhereLifeGoes";
import { ReviewFinish, ReviewQuests } from "@/components/ReviewForms";
import { LockedCard } from "@/components/bits";
import { calendarStore } from "@/lib/calendar/store";
import { formatMinutes } from "@/lib/copy";
import { appNow, canConnectCalendar, isUnlocked, timezone, unlockState } from "@/lib/db/derive";
import { loadDbOrLogin } from "@/lib/db/store";
import { lockedHint, reviewWeekFor } from "@/lib/game";
import { reviewCalendarTime } from "@/lib/game/time";
import { addDays, dayKey, formatDay } from "@/lib/time";
import { buildReview } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const db = await loadDbOrLogin();
  const now = appNow(db);
  if (!isUnlocked(db, "weekly_review")) {
    return <LockedCard title="Weekly review" hint={lockedHint("weekly_review", unlockState(db, now))} />;
  }
  const tz = timezone(db);
  const today = dayKey(now, tz);
  const week = reviewWeekFor(today);
  const view = buildReview(db, week, addDays(week, 7));
  // A failed or unconfigured calendar must still allow the weekly review.
  const calendar = !view.alreadyDone && canConnectCalendar(db)
    ? await calendarStore().then((store) => store.load()).catch(() => null)
    : null;
  const reflection = calendar && reviewCalendarTime(calendar.events, {
    week, now: new Date(), tz,
    wakingStart: calendar.wakingStart, wakingEnd: calendar.wakingEnd,
    lastSyncs: calendar.sources.map((source) => source.lastSyncedAt),
  });

  return (
    <main className="panel" style={{ maxWidth: 760, width: "100%", justifySelf: "center" }}>
      <div className="panel-h">
        <h2>Weekly review</h2>
        <span className="label">{view.weekLabel}</span>
      </div>
      {view.alreadyDone ? (
        <p className="empty">This week is reviewed. The next one opens on Sunday.</p>
      ) : (
        <div className="steps">
          <section style={{ display: "grid", gap: 10 }}>
            <div className="step-h">
              <span className="n">1 / 3</span>
              <h3>Where life went this week</h3>
            </div>
            <div className="label">True North</div>
            <p className="why">{view.header.trueNorth}</p>
            <ShareBars rows={view.rows} />
            <p className="insight">{view.insight} Does that match where you are heading?</p>
            {reflection && (
              <div>
                <h4>Calendar reflection</h4>
                <p className="insight">
                  Your calendar showed <strong>{formatMinutes(reflection.freeMinutes)} free</strong> during waking hours{" "}
                  {reflection.through === week
                    ? `on ${formatDay(week, today)}`
                    : `from ${formatDay(week, today)} to ${formatDay(reflection.through, today)}`}.
                  How much of that time felt usable?
                </p>
              </div>
            )}
          </section>
          <section style={{ display: "grid", gap: 10 }}>
            <div className="step-h">
              <span className="n">2 / 3</span>
              <h3>Choose the threads for next week</h3>
            </div>
            <p className="insight">Pause what can wait. Resume what is calling. Pausing frees a slot.</p>
            <ReviewQuests quests={view.quests} slots={view.slots} sideUnlocked={view.sideUnlocked} />
          </section>
          <section style={{ display: "grid", gap: 10 }}>
            <div className="step-h">
              <span className="n">3 / 3</span>
              <h3>One line for the logbook</h3>
            </div>
            <ReviewFinish baseline={view.baseline} calendarReflection={reflection !== null} />
          </section>
        </div>
      )}
    </main>
  );
}
