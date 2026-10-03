import { ShareBars } from "@/components/map/WhereLifeGoes";
import { ReviewFinish, ReviewQuests } from "@/components/ReviewForms";
import { LockedCard } from "@/components/bits";
import { appNow, isUnlocked, timezone } from "@/lib/db/derive";
import { readDb } from "@/lib/db/local-store";
import { lockedHint, reviewWeekFor } from "@/lib/game";
import { unlockState } from "@/lib/db/derive";
import { addDays, dayKey } from "@/lib/time";
import { buildReview } from "@/lib/view";

export const dynamic = "force-dynamic";

export default function ReviewPage() {
  const db = readDb();
  const now = appNow(db);
  if (!isUnlocked(db, "weekly_review")) {
    return <LockedCard title="Weekly review" hint={lockedHint("weekly_review", unlockState(db, now))} />;
  }
  const week = reviewWeekFor(dayKey(now, timezone(db)));
  const view = buildReview(db, week, addDays(week, 7));

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
            <ReviewFinish baseline={view.baseline} />
          </section>
        </div>
      )}
    </main>
  );
}
