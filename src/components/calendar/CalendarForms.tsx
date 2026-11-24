"use client";

import { useState } from "react";
import {
  addCalendarRule, confirmSuggestion, connectIcs, disconnectCalendar, dismissSuggestion,
  previewCalendarRule, refreshCalendar, removeCalendarRule, saveWakingHours, type RulePreview,
} from "@/lib/actions/calendar";
import type { CalendarRule, CalendarSource } from "@/lib/calendar/types";
import { ATTRIBUTES, ATTRIBUTE_NAMES, type Attribute } from "@/lib/game";
import { useAction } from "../Toast";

type QuestOption = { id: string; title: string };

function ruleTarget(rule: CalendarRule, quests: QuestOption[]) {
  return rule.attribute ? ATTRIBUTE_NAMES[rule.attribute] : quests.find((q) => q.id === rule.questId)?.title ?? "Inactive quest";
}

function Feedback({ error }: { error: string | null }) {
  return error && <p className="error" role="alert">{error}</p>;
}

export function SourceControls({ source, lastSync }: { source: CalendarSource; lastSync: string | null }) {
  const { go, pending, error } = useAction();
  const [removing, setRemoving] = useState(false);
  return (
    <li className="calendar-item">
      <div>
        <b>{source.name}</b>
        <p className="insight">{source.kind === "ics" ? "ICS" : "Google"} · {lastSync ? `Synced ${lastSync}` : "Awaiting first successful sync"}</p>
      </div>
      {removing ? (
        <div>
          <p className="insight">Disconnect this calendar? Your logged checkpoints stay in their quests.</p>
          <div className="calendar-buttons">
            <button className="btn" disabled={pending} onClick={() => go(() => disconnectCalendar(source.id))}>Confirm disconnect</button>
            <button className="btn ghost" onClick={() => setRemoving(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="calendar-buttons">
          <button className="btn ghost" disabled={pending} onClick={() => go(() => refreshCalendar(source.id))}>{pending ? "Syncing…" : "Sync"}</button>
          <button className="btn ghost" disabled={pending} onClick={() => setRemoving(true)}>Disconnect</button>
        </div>
      )}
      <Feedback error={error} />
    </li>
  );
}

export function ConnectSource({ googleEnabled }: { googleEnabled: boolean }) {
  const { go, pending, error } = useAction();
  return (
    <>
      <form className="form" onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fields = new FormData(form);
        go(() => connectIcs({ name: String(fields.get("name")), url: String(fields.get("url")) }), () => form.reset());
      }}>
        <label className="field">
          <span>Calendar name</span><input type="text" name="name" required maxLength={80} placeholder="Personal" />
        </label>
        <label className="field">
          <span>ICS subscription URL</span>
          <input type="url" name="url" required maxLength={4096} autoComplete="off" spellCheck={false} />
          <small>Paste a read-only subscription link from iCloud, Outlook, or another calendar.</small>
        </label>
        <div><button className="btn" disabled={pending}>{pending ? "Connecting…" : "Connect calendar"}</button></div>
        <Feedback error={error} />
      </form>
      {googleEnabled
        ? <div><a className="btn ghost" href="/api/calendar/google/start">Connect Google Calendar</a></div>
        : <p className="insight">Google sign-in for Calendar is unavailable here. You can connect a Google calendar with its ICS subscription URL.</p>}
    </>
  );
}

export function WakingHours({ start, end, timezone }: { start: string; end: string; timezone: string }) {
  const { go, pending, error } = useAction();
  return (
    <form className="form" onSubmit={(e) => {
      e.preventDefault();
      const fields = new FormData(e.currentTarget);
      go(() => saveWakingHours({ start: String(fields.get("start")), end: String(fields.get("end")) }));
    }}>
      <p className="insight">Free time is the space between busy events during your waking hours in {timezone}.</p>
      <div className="calendar-hour-inputs">
        <label className="field"><span>Wake up</span><input required type="time" name="start" defaultValue={start} /></label>
        <label className="field"><span>End of waking day</span><input required type="time" name="end" defaultValue={end} /></label>
      </div>
      <div><button className="btn" disabled={pending}>Save hours</button></div>
      <Feedback error={error} />
    </form>
  );
}

export function TaggingRules({ rules, quests }: { rules: CalendarRule[]; quests: QuestOption[] }) {
  const { go, error, pending } = useAction();
  const [preview, setPreview] = useState<RulePreview[] | null>(null);
  return (
    <>
      <p className="insight">Match a word in an event title to a quest or attribute. After the event you can choose to log a checkpoint.</p>
      {rules.length > 0 && <ul className="calendar-list">
        {rules.map((rule) => (
          <li key={rule.id} className="calendar-item">
            <span>“{rule.match}” → {ruleTarget(rule, quests)}</span>
            <button type="button" className="btn ghost" aria-label={`Remove rule for ${rule.match}`} disabled={pending} onClick={() => go(() => removeCalendarRule(rule.id))}>Remove</button>
          </li>
        ))}
      </ul>}
      <form className="form" onChange={() => setPreview(null)} onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fields = new FormData(form);
        const choice = String(fields.get("target"));
        const target = choice.startsWith("quest:")
          ? { kind: "quest" as const, id: choice.slice("quest:".length) }
          : { kind: "attribute" as const, id: choice.slice("attribute:".length) as Attribute };
        const draft = { match: String(fields.get("match")), target };
        if ((e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "preview") {
          setPreview(null);
          go(async () => {
            const result = await previewCalendarRule(draft);
            if (result.ok) setPreview(result.matches);
            return result;
          });
        } else {
          go(() => addCalendarRule(draft), () => {
            form.reset();
            setPreview(null);
          });
        }
      }}>
        <label className="field"><span>Title contains</span><input type="text" name="match" required maxLength={100} placeholder="For example, gym" disabled={pending} /></label>
        <label className="field"><span>Suggest a checkpoint for</span>
          <select name="target" required defaultValue="" disabled={pending}>
            <option value="" disabled>Choose a quest or attribute</option>
            {quests.length > 0 && <optgroup label="Active quests">{quests.map((q) => <option value={`quest:${q.id}`} key={q.id}>{q.title}</option>)}</optgroup>}
            <optgroup label="Attributes">{ATTRIBUTES.map((attr) => <option key={attr} value={`attribute:${attr}`}>{ATTRIBUTE_NAMES[attr]}</option>)}</optgroup>
          </select>
        </label>
        <div className="calendar-buttons">
          <button className="btn" disabled={pending}>Add rule</button>
          <button className="btn ghost" value="preview" disabled={pending}>Preview matches</button>
        </div>
      </form>
      <div aria-live="polite">
        {preview && (preview.length ? (
          <section aria-label="Recent matches">
            <h3>Recent matches</h3>
            <ul className="calendar-list">
              {preview.map((event) => <li className="calendar-item" key={event.id}>
                <div><b>{event.title}</b><p className="insight">{event.date} · {event.quests.join(", ")}</p></div>
              </li>)}
            </ul>
          </section>
        ) : <p className="insight">No recent events would be suggested for an active quest.</p>)}
      </div>
      <Feedback error={error} />
    </>
  );
}

export function Suggestion({ eventId, title, detail, quests, rules, canDismiss }: {
  eventId: string; title: string; detail: string; quests: QuestOption[]; rules: CalendarRule[]; canDismiss: boolean;
}) {
  const { go, pending, error } = useAction();
  return (
    <li className="calendar-item">
      <div>
        <b>{title}</b><p className="insight">{detail}</p>
        <details>
          <summary>Why this was suggested</summary>
          <ul>{rules.map((rule) => <li key={rule.id}>“{rule.match}” → {ruleTarget(rule, quests)}</li>)}</ul>
        </details>
      </div>
      <form className="calendar-buttons" onSubmit={(e) => {
        e.preventDefault();
        const selected = quests.length === 1 ? quests[0].id : String(new FormData(e.currentTarget).get("quest"));
        go(() => confirmSuggestion({ eventId, questId: selected }));
      }}>
        {quests.length === 1 ? <span>{quests[0].title}</span> : <select required aria-label={`Quest for ${title}`} name="quest" defaultValue="">
          <option value="" disabled>Choose quest</option>
          {quests.map((q) => <option value={q.id} key={q.id}>{q.title}</option>)}
        </select>}
        <button className="btn" disabled={pending}>Log checkpoint</button>
        {canDismiss && <button type="button" className="btn ghost" aria-label={`Dismiss ${title}`} disabled={pending} onClick={() => go(() => dismissSuggestion(eventId))}>
          Dismiss
        </button>}
      </form>
      <Feedback error={error} />
    </li>
  );
}
