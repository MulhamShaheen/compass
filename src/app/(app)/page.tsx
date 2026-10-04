import Link from "next/link";
import { LockedCard } from "@/components/bits";
import { CharacterPanel } from "@/components/map/CharacterPanel";
import { HabitsPanel, Logbook, TodayPanel, UnlockCards } from "@/components/map/Daily";
import { QuestPanel } from "@/components/map/QuestPanel";
import { WhereLifeGoes } from "@/components/map/WhereLifeGoes";
import { loadDbOrLogin } from "@/lib/db/store";
import { buildMap } from "@/lib/view";

export const dynamic = "force-dynamic";

/** The map: the dashboard. Sections stay locked until play opens them. */
export default async function MapPage() {
  const view = buildMap(await loadDbOrLogin());
  const { unlocked, hints } = view;
  const quiet = view.header.quietMode;
  const showLeft = !quiet;

  return (
    <main style={{ display: "grid", gap: 18 }}>
      <UnlockCards fresh={view.fresh} />
      {view.reviewDue && (
        <div className="nudge">
          <p>A new week is turning. Five minutes to look back and choose the next one.</p>
          <Link className="btn" href="/review">
            Start the weekly review
          </Link>
        </div>
      )}
      <div className={`board${quiet ? " quiet" : ""}`}>
        {showLeft && (
          <div className="col">
            {unlocked.character ? <CharacterPanel attributes={view.attributes} /> : <LockedCard title="Character" hint={hints.character} />}
            {unlocked.where_life_goes ? (
              <WhereLifeGoes where={view.where} />
            ) : (
              <LockedCard title="Where life goes" hint={hints.where_life_goes} />
            )}
          </div>
        )}
        <div className="col col-quests">
          <QuestPanel
            quests={view.quests}
            slots={view.slots}
            sideUnlocked={unlocked.side_quests}
            sideHint={hints.side_quests}
            prologueId={view.prologueId}
          />
        </div>
        <div className="col">
          <TodayPanel loop={view.loop} weather={view.weather} todayLabel={view.header.todayLabel} />
          {unlocked.habits ? (
            <HabitsPanel habits={view.habits} slots={view.habitSlots} reviews={view.reviewsCompleted} />
          ) : (
            <LockedCard title="Habits" hint={hints.habits} />
          )}
          {!unlocked.weekly_review && <LockedCard title="Weekly review" hint={hints.weekly_review} />}
        </div>
      </div>
      <Logbook journal={view.journal} />
    </main>
  );
}
