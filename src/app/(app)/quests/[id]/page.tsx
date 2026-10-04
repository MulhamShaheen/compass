import Link from "next/link";
import { notFound } from "next/navigation";
import { AttrTag, Chip } from "@/components/bits";
import { CheckpointForm, EditQuest, QuestActions, Timeline } from "@/components/thread/Thread";
import { formatMinutes } from "@/lib/copy";
import { loadDbOrLogin } from "@/lib/db/store";
import { buildThread } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function QuestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = buildThread(await loadDbOrLogin(), id);
  if (!view) notFound();
  const { quest, stats } = view;
  const system = quest.type === "system";

  return (
    <main className="panel" style={{ maxWidth: 820, width: "100%", justifySelf: "center" }}>
      <div className="thread">
        <div>
          <Link className="link" href="/">
            ← All quests
          </Link>
        </div>
        <div className="thead">
          <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "start" }}>
            <h2>{quest.title}</h2>
            <Chip type={quest.type} status={quest.status} />
          </div>
          {quest.why && <p className="why">{quest.why}</p>}
          {quest.attrs.length > 0 && (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {quest.attrs.map((a) => (
                <AttrTag key={a} attr={a} />
              ))}
            </div>
          )}
          <EditQuest quest={quest} />
        </div>
        <div className="stats">
          <div className="stat">
            <span className="label">Started</span>
            <b>{stats.startedLabel}</b>
          </div>
          <div className="stat">
            <span className="label">Running</span>
            <b>{stats.daysRunning} days</b>
          </div>
          <div className="stat">
            <span className="label">{system ? "Entries" : "Checkpoints"}</span>
            <b>{stats.checkpoints}</b>
          </div>
          {!system && (
            <>
              <div className="stat">
                <span className="label">Time</span>
                <b>{formatMinutes(stats.minutes)}</b>
              </div>
              <div className="stat">
                <span className="label">Points</span>
                <b data-testid="quest-points">{stats.points}</b>
              </div>
            </>
          )}
        </div>
        {system && <p className="insight">The story of how you started. Each unlock and review adds a line here. It earns no points.</p>}
        {!system && quest.status !== "done" && <CheckpointForm key={view.timeline.length} quest={quest} nowInput={view.nowInput} />}
        <QuestActions quest={quest} />
        <div>
          <div className="label" style={{ marginBottom: 10 }}>
            The thread so far
          </div>
          <Timeline items={view.timeline} quest={quest} />
        </div>
      </div>
    </main>
  );
}
