"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createCheckpoint, deleteCheckpoint, setQuestStatus, updateCheckpoint, updateQuest } from "@/lib/actions/quests";
import { formatMinutes, TIME_OPTIONS } from "@/lib/copy";
import { checkpointPoints, splitByAttributes } from "@/lib/game/points";
import { ATTRIBUTE_NAMES, type Attribute } from "@/lib/game/types";
import type { ThreadView, TimelineItem } from "@/lib/view";
import { AttrTag } from "../bits";
import { useAction } from "../Toast";

type QuestAttrs = { primaryAttr: Attribute; secondaryAttr: Attribute | null };

function earns(quest: QuestAttrs, minutes: number, isMilestone: boolean) {
  return splitByAttributes(quest, checkpointPoints({ minutes, isMilestone }))
    .map(([a, v]) => `${Math.round(v)} ${ATTRIBUTE_NAMES[a]}`)
    .join(" and ");
}

/** Time options, plus the current value when it is not one of the presets. */
function timeOptions(current: number) {
  return TIME_OPTIONS.some(([m]) => m === current) ? TIME_OPTIONS : [...TIME_OPTIONS, [current, formatMinutes(current)] as [number, string]].sort((a, b) => a[0] - b[0]);
}

export function CheckpointForm({ quest, nowInput, nextStep }: Pick<ThreadView, "quest" | "nowInput" | "nextStep">) {
  const router = useRouter();
  const { go, pending, error } = useAction();
  const [title, setTitle] = useState(nextStep?.title ?? "");
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState(nowInput);
  const [minutes, setMinutes] = useState(60);
  const [isMilestone, setMilestone] = useState(false);
  return (
    <form
      className="cpform"
      id="checkpoint"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        go(
          () => createCheckpoint({ questId: quest.id, title, note, occurredAt, minutes, isMilestone, nextStepId: nextStep?.id }),
          () => {
            if (nextStep) router.replace(`/quests/${quest.id}#checkpoint`, { scroll: false });
            setTitle("");
            setNote("");
            setMilestone(false);
          },
        );
      }}
    >
      <div className="label">Log a checkpoint</div>
      {nextStep && <p>What happened? Edit your next step to record what you actually did.</p>}
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What happened? e.g. Ran 8K without stopping" aria-label="Checkpoint title" />
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Commentary: how it went, what you noticed, what's next" aria-label="Commentary" />
      <div className="row">
        <input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} aria-label="Date and time" />
        <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} aria-label="Time spent">
          {TIME_OPTIONS.map(([m, label]) => (
            <option key={m} value={m}>
              {label}
            </option>
          ))}
        </select>
        <label className="ms">
          <input type="checkbox" checked={isMilestone} onChange={(e) => setMilestone(e.target.checked)} /> Milestone
        </label>
      </div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="preview" data-testid="earns">
          Earns {earns(quest, minutes, isMilestone)}
        </span>
        <button className="btn" type="submit" disabled={pending || !title.trim()}>
          Log checkpoint
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function EditCheckpoint({ item, quest, onDone }: { item: TimelineItem; quest: QuestAttrs; onDone: () => void }) {
  const { go, pending, error } = useAction();
  const [title, setTitle] = useState(item.title);
  const [note, setNote] = useState(item.note ?? "");
  const [occurredAt, setOccurredAt] = useState(item.localInput);
  const [minutes, setMinutes] = useState(item.minutes);
  const [isMilestone, setMilestone] = useState(item.isMilestone);
  const changed = title.trim() !== item.title || note.trim() !== (item.note ?? "") ||
    occurredAt !== item.localInput || minutes !== item.minutes || isMilestone !== item.isMilestone;
  return (
    <form
      className="edit"
      aria-label={`Edit ${item.title}`}
      onSubmit={(e) => {
        e.preventDefault();
        go(() => updateCheckpoint({ id: item.id, title, note, occurredAt, minutes, isMilestone }), onDone);
      }}
    >
      <label className="checkpoint-field">Checkpoint title
        <input autoFocus required maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} disabled={pending} />
      </label>
      <label className="checkpoint-field">Commentary
        <textarea maxLength={4000} value={note} onChange={(e) => setNote(e.target.value)} disabled={pending} />
      </label>
      <div className="row">
        <label className="checkpoint-field">Date and time
          <input required type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} disabled={pending} />
        </label>
        <label className="checkpoint-field">Time spent
          <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} disabled={pending}>
            {timeOptions(item.minutes).map(([m, label]) => <option key={m} value={m}>{label}</option>)}
          </select>
        </label>
        <label className="ms">
          <input type="checkbox" checked={isMilestone} onChange={(e) => setMilestone(e.target.checked)} disabled={pending} /> Milestone
        </label>
      </div>
      <span className="preview">Earns {earns(quest, minutes, isMilestone)}</span>
      <div className="actions">
        <button className="btn" type="submit" disabled={pending || !changed || !title.trim()}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        <button className="link" type="button" disabled={pending} onClick={onDone}>Cancel</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  );
}

function TimelineEntry({ item, quest, index, onRemoved }: {
  item: TimelineItem; quest: QuestAttrs; index: number; onRemoved: () => void;
}) {
  const { go, pending, error } = useAction();
  const [mode, setMode] = useState<"read" | "edit" | "remove">("read");
  const heading = useRef<HTMLHeadingElement>(null);
  function close() {
    setMode("read");
    heading.current?.focus();
  }
  return (
    <li className={`cp${item.isMilestone ? " ms" : ""}`} style={{ "--k": Math.min(index, 12) } as React.CSSProperties}>
      <div className="rail"><span className="dot" /></div>
      <div className="body">
        <div className="when">
          <span>{item.dateLabel} · {item.timeLabel}</span>
          <span>{item.rel}</span>
          {item.isMilestone && <span style={{ color: "var(--brass)" }}>Milestone</span>}
        </div>
        <h4 tabIndex={-1} ref={heading}>{item.title}</h4>
        {mode !== "edit" && item.note && <p>{item.note}</p>}
        {mode === "edit" && <EditCheckpoint item={item} quest={quest} onDone={close} />}
        {mode === "remove" && (
          <div className="checkpoint-confirm" role="group" aria-label={`Remove ${item.title}?`}>
            <strong>Remove “{item.title}”?</strong>
            <p>Its time and points will be removed from your totals.</p>
            <div className="actions">
              <button className="btn ghost" autoFocus disabled={pending} onClick={close}>Keep checkpoint</button>
              <button className="link" disabled={pending}
                onClick={() => go(() => deleteCheckpoint({ id: item.id }), onRemoved)}>
                {pending ? "Removing…" : "Remove checkpoint"}
              </button>
            </div>
            {error && <p className="error" role="alert">{error}</p>}
          </div>
        )}
        {mode === "read" && !item.isSystem && (
          <div className="gain">
            {item.minutes > 0 && <span className="mono">{formatMinutes(item.minutes)}</span>}
            {item.gain.map(([a, v]) => (
              <AttrTag key={a} attr={a}>+{v} {ATTRIBUTE_NAMES[a]}</AttrTag>
            ))}
            <button className="link" onClick={() => setMode("edit")}>Edit</button>
            <button className="link" onClick={() => setMode("remove")}>Remove</button>
          </div>
        )}
        {item.gap && <div className="gap">{item.gap}</div>}
      </div>
    </li>
  );
}

export function Timeline({ items, quest }: { items: TimelineItem[]; quest: QuestAttrs }) {
  const timeline = useRef<HTMLDivElement>(null);
  return (
    <div ref={timeline} tabIndex={-1} role="region" aria-label="Checkpoint timeline">
      {items.length ? (
        <ol className="timeline">
          {items.map((item, i) => (
            <TimelineEntry key={item.id} item={item} quest={quest} index={i} onRemoved={() => timeline.current?.focus()} />
          ))}
        </ol>
      ) : <p className="empty">No checkpoints yet. Log the first one above.</p>}
    </div>
  );
}

export function QuestActions({ quest }: { quest: ThreadView["quest"] }) {
  const { go, pending, error } = useAction();
  if (quest.type === "system") return null;
  const set = (status: "active" | "paused" | "done") => go(() => setQuestStatus({ questId: quest.id, status }));
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div className="actions">
        {quest.status === "active" ? (
          <>
            <button className="btn ghost" disabled={pending} onClick={() => set("paused")}>
              Pause quest
            </button>
            <button className="btn ghost" disabled={pending} onClick={() => set("done")}>
              Complete quest
            </button>
          </>
        ) : (
          <button className="btn ghost" disabled={pending} onClick={() => set("active")}>
            {quest.status === "done" ? "Reopen" : "Resume"} quest
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

export function EditQuest({ quest }: { quest: ThreadView["quest"] }) {
  const { go, pending, error } = useAction();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(quest.title);
  const [why, setWhy] = useState(quest.why ?? "");
  if (quest.type === "system") return null;
  if (!open)
    return (
      <div>
        <button className="link" onClick={() => setOpen(true)}>
          Rename or change the why
        </button>
      </div>
    );
  return (
    <form
      className="cpform"
      onSubmit={(e) => {
        e.preventDefault();
        go(() => updateQuest({ id: quest.id, title, why }), () => setOpen(false));
      }}
    >
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Quest name" />
      <input type="text" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why it matters" aria-label="Why it matters" />
      <div className="row">
        <button className="btn ghost" type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button className="btn" type="submit" disabled={pending || !title.trim()}>
          Save
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
