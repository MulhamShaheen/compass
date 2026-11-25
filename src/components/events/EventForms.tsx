"use client";

import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { createEvent, deleteEvent, setEventCompleted, updateEvent } from "@/lib/actions/events";
import type { CompassEvent } from "@/lib/db/schema";
import { ATTRIBUTES, ATTRIBUTE_NAMES } from "@/lib/game/types";
import { dateToLocalInput } from "@/lib/time";
import { useAction } from "@/components/Toast";

export interface EventQuest {
  id: string;
  title: string;
  checkpoints: { id: string; label: string }[];
}

interface EventFormProps {
  event?: CompassEvent;
  quests: EventQuest[];
  timezone: string;
  initialStart: string;
  initialEnd: string;
  initialQuestId?: string;
  initialCheckpointId?: string;
  onCancel?: () => void;
  onSaved?: () => void;
}

export function EventForm({
  event, quests, timezone, initialStart, initialEnd, initialQuestId = "", initialCheckpointId = "", onCancel, onSaved,
}: EventFormProps) {
  const { go, pending, error } = useAction();
  const defaultQuest = event ? event.questId ?? "" : initialQuestId;
  const defaultCheckpoint = event ? event.checkpointId ?? "" : initialCheckpointId;
  const [questId, setQuestId] = useState(defaultQuest);
  const [checkpointId, setCheckpointId] = useState(defaultCheckpoint);
  const [openedRevision] = useState(event?.revision ?? 0);
  const quest = quests.find((option) => option.id === questId);

  return (
    <form className="event-form" aria-label={event ? "Edit event" : "Add event"} onSubmit={(e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const values = new FormData(form);
      const input = {
        title: String(values.get("title")),
        note: String(values.get("note")),
        startsAt: String(values.get("startsAt")),
        endsAt: String(values.get("endsAt")),
        questId: quest?.id ?? null,
        checkpointId: quest?.checkpoints.some((option) => option.id === checkpointId) ? checkpointId : null,
        attribute: ATTRIBUTES.find((attr) => attr === values.get("attribute")) ?? ATTRIBUTES[0],
      };
      go(() => event ? updateEvent({ ...input, id: event.id, revision: openedRevision }) : createEvent(input), () => {
        if (onSaved) onSaved();
        else {
          form.reset();
          setQuestId(defaultQuest);
          setCheckpointId(defaultCheckpoint);
        }
      });
    }}>
      <fieldset disabled={pending}>
        <label>Event title<input name="title" required maxLength={160} defaultValue={event?.title} autoFocus={!!event} /></label>
        <div className="event-form-row">
          <label>Starts<input name="startsAt" required type="datetime-local" defaultValue={event ? dateToLocalInput(new Date(event.startsAt), timezone) : initialStart} /></label>
          <label>Ends<input name="endsAt" required type="datetime-local" defaultValue={event ? dateToLocalInput(new Date(event.endsAt), timezone) : initialEnd} /></label>
        </div>
        <p className="event-detail">Times in {timezone}.</p>
        <label>Notes (optional)<textarea name="note" rows={2} maxLength={4000} defaultValue={event?.note ?? ""} /></label>
        <div className="event-form-row">
          <label>Quest (optional)
            <select value={questId} onChange={(e) => { setQuestId(e.target.value); setCheckpointId(""); }}>
              <option value="">Standalone event</option>
              {quests.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
            </select>
          </label>
          {quest?.checkpoints.length ? (
            <label>Checkpoint (optional)
              <select value={checkpointId} onChange={(e) => setCheckpointId(e.target.value)}>
                <option value="">None</option>
                {quest.checkpoints.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
          ) : null}
          <label hidden={!!quest}>Attribute
            <select name="attribute" defaultValue={event?.attribute ?? ATTRIBUTES[0]}>
              {ATTRIBUTES.map((attr) => <option key={attr} value={attr}>{ATTRIBUTE_NAMES[attr]}</option>)}
            </select>
          </label>
        </div>
        {checkpointId && <p className="event-detail">Points for this activity come from its checkpoint.</p>}
        <div className="actions">
          <button type="submit" className="btn">{pending ? "Saving…" : event ? "Save changes" : "Save event"}</button>
          {onCancel && <button type="button" className="link" onClick={onCancel}>Cancel</button>}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
      </fieldset>
    </form>
  );
}

interface EventCardProps {
  event: CompassEvent;
  quests: EventQuest[];
  timezone: string;
  schedule: string;
  started: boolean;
  points: number;
  published: boolean;
  googleControls?: ReactNode;
}

export function EventCard({ event, quests, timezone, schedule, started, points, published, googleControls }: EventCardProps) {
  const [mode, setMode] = useState<"read" | "edit" | "remove">("read");
  const [removalRevision, setRemovalRevision] = useState(event.revision);
  const { go, pending, error } = useAction();
  const heading = useRef<HTMLHeadingElement>(null);
  const quest = quests.find((option) => option.id === event.questId);
  const checkpoint = quest?.checkpoints.find((option) => option.id === event.checkpointId);
  const close = () => { setMode("read"); heading.current?.focus(); };
  const completed = !!event.completedAt;

  return (
    <li className="event-card" id={`event-${event.id}`}>
      <div>
        <p className="event-detail">{schedule}</p>
        <h3 ref={heading} tabIndex={-1}>{event.title}</h3>
        <p className="event-detail">
          {quest ? <Link className="link" href={`/quests/${quest.id}`}>{quest.title}</Link> : ATTRIBUTE_NAMES[event.attribute]}
          {checkpoint && <> · {checkpoint.label}</>}
        </p>
      </div>
      {mode === "edit" ? (
        <EventForm event={event} quests={quests} timezone={timezone} initialStart="" initialEnd="" onCancel={close} onSaved={close} />
      ) : (
        <>
          {event.note && <p className="event-note">{event.note}</p>}
          <p className="event-detail">
            {completed ? (checkpoint ? "Completed · Points recorded in checkpoint" : `Completed · ${points} ${points === 1 ? "point" : "points"}`) : "Planned"}
          </p>
          {mode === "remove" ? (
            <div className="event-removal">
              <p>Delete “{event.title}”? Any points earned from this event will be removed.</p>
              <div className="actions">
                <button className="btn ghost" type="button" autoFocus disabled={pending} onClick={close}>Keep event</button>
                <button className="link" type="button" disabled={pending || published} onClick={() => go(() => deleteEvent({ id: event.id, revision: removalRevision }))}>{pending ? "Deleting…" : "Delete event"}</button>
              </div>
            </div>
          ) : (
            <>
              <div className="actions">
                {(completed || started) && (
                  <button className="btn ghost" type="button" disabled={pending} onClick={() => go(() => setEventCompleted({ id: event.id, revision: event.revision, completed: !completed }))}>
                    {completed ? "Reopen event" : "Complete event"}
                  </button>
                )}
                <button className="link" type="button" disabled={pending} onClick={() => setMode("edit")}>Edit event</button>
                <button className="link" type="button" disabled={pending || published} aria-describedby={published ? `published-${event.id}` : undefined} onClick={() => {
                  setRemovalRevision(event.revision);
                  setMode("remove");
                }}>Remove event</button>
                <a className="link" href={`/api/events/ics?id=${encodeURIComponent(event.id)}`} download>Download .ics</a>
              </div>
              {published && <p className="event-detail" id={`published-${event.id}`}>Remove the Google Calendar copy before deleting this event.</p>}
              {googleControls}
            </>
          )}
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </li>
  );
}
