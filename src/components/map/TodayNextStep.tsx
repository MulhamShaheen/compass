"use client";

import Link from "next/link";
import { useState } from "react";
import { clearNextStep, saveNextStep } from "@/lib/actions/next-step";
import type { MapView } from "@/lib/view";
import { useAction } from "../Toast";

export function TodayNextStep({ quests, plan, today }: MapView["nextStep"]) {
  const { go, pending, error } = useAction();
  const [editing, setEditing] = useState(false);
  const [questId, setQuestId] = useState(plan?.questId ?? quests[0]?.id);
  const [title, setTitle] = useState(plan?.title ?? "");
  const quest = quests.find((q) => q.id === questId);
  if (!quest) return null;

  const carried = plan && plan.day < today;
  const thread = `/quests/${quest.id}`;
  const cancel = () => {
    setTitle(plan?.title ?? "");
    setQuestId(plan?.questId ?? quests[0]?.id);
    setEditing(false);
  };

  return (
    <div className="today-next-step">
      <div>
        <span className="label">Main quest</span>
        <h3>{quest.title}</h3>
        {quest.last && <p className="step-context">Last checkpoint · {quest.last.title} ({quest.last.rel})</p>}
      </div>
      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            go(() => saveNextStep({ questId: quest.id, title, expectedId: plan?.id ?? null }), () => setEditing(false));
          }}
        >
          {quests.length > 1 && (
            <label>
              <span className="label">Quest for next step</span>
              <select value={quest.id} onChange={(event) => setQuestId(event.target.value)}>
                {quests.map((q) => <option key={q.id} value={q.id}>{q.title}</option>)}
              </select>
            </label>
          )}
          <label>
            <span className="label">Next step</span>
            <input
              type="text"
              autoFocus
              required
              maxLength={160}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Walk to the park and jog one lap"
            />
          </label>
          <div className="actions">
            <button className="btn" type="submit" disabled={pending || !title.trim()}>Save next step</button>
            <button className="link" type="button" disabled={pending} onClick={cancel}>Cancel</button>
          </div>
        </form>
      ) : plan ? (
        <>
          <div>
            <span className="label">{carried ? "From an earlier day" : "Your next step"}</span>
            <p className="step-title">{plan.title}</p>
          </div>
          <div className="actions">
            {carried && (
              <button
                className="btn"
                disabled={pending}
                onClick={() => go(() => saveNextStep({ questId: quest.id, title: plan.title, expectedId: plan.id }))}
              >
                Keep it
              </button>
            )}
            <Link className={carried ? "link" : "btn"} href={`${thread}?step=${plan.id}#checkpoint`}>Log what happened</Link>
            <button className="link" disabled={pending} onClick={() => setEditing(true)}>Change it</button>
            <button className="link" disabled={pending} onClick={() => go(() => clearNextStep({ expectedId: plan.id }))}>Let it go</button>
          </div>
        </>
      ) : (
        <div className="actions">
          <button className="btn ghost" onClick={() => setEditing(true)}>Choose a next step</button>
          <Link className="link" href={`${thread}#checkpoint`}>Log a checkpoint</Link>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
