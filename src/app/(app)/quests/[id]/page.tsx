import Link from "next/link";
import { notFound } from "next/navigation";
import { AttrTag, Chip } from "@/components/bits";
import { CheckpointForm, EditQuest, QuestActions, Timeline } from "@/components/thread/Thread";
import { formatMinutes } from "@/lib/copy";
import { loadDbOrLogin } from "@/lib/db/store";
import { buildThread } from "@/lib/view";

export const dynamic = "force-dynamic";

export default async function QuestPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string | string[] }>;
}) {
  const [{ id }, { step }] = await Promise.all([params, searchParams]);
  const view = buildThread(await loadDbOrLogin(), id);
  if (!view) notFound();
  const { quest, stats } = view;
  const system = quest.type === "system";
  const nextStep = step === view.nextStep?.id ? view.nextStep : null;

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
        {step !== undefined && !nextStep ? (
          <div className="cpform" id="checkpoint">
            <p>This next step has changed. Open Today to see your current step.</p>
            <div className="actions">
              <Link className="btn ghost" href="/">Back to Today</Link>
              {!system && quest.status !== "done" && (
                <Link className="link" href={`/quests/${id}#checkpoint`}>Log a separate checkpoint</Link>
              )}
            </div>
          </div>
        ) : !system && quest.status !== "done" && (
          <CheckpointForm key={`${view.timeline.length}-${nextStep?.id ?? "manual"}`} quest={quest} nowInput={view.nowInput} nextStep={nextStep} />
        )}
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
