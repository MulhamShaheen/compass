"use client";

import { useRef, useState } from "react";
import { changeJournalEntry } from "@/lib/actions/daily";
import { WEATHER_NAMES } from "@/lib/game/types";
import type { MapView } from "@/lib/view";
import { useAction } from "../Toast";

type Entry = MapView["journal"]["entries"][number];

export function JournalCard({ entry }: { entry: Entry }) {
  const [mode, setMode] = useState<"read" | "edit" | "delete">("read");
  const [draft, setDraft] = useState("");
  const [original, setOriginal] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { go, pending, error } = useAction();
  const editButton = useRef<HTMLButtonElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLElement>(null);

  function open(next: "edit" | "delete") {
    setOriginal(entry.body);
    setSubmitted(false);
    setDraft(entry.body);
    setMode(next);
  }

  function close() {
    const trigger = mode === "edit" ? editButton : deleteButton;
    setMode("read");
    requestAnimationFrame(() => trigger.current?.focus());
  }

  function save(body: string | null) {
    setSubmitted(true);
    const entries = card.current?.parentElement;
    go(() => changeJournalEntry({ id: entry.id, expected: original, body }), () => {
      if (body !== null) close();
      else requestAnimationFrame(() => entries?.focus());
    });
  }

  return (
    <article className="entry" ref={card} aria-label={`Logbook entry · ${entry.day}`}>
      <div className="meta">
        <span className="mono">{entry.day}</span>
        {entry.weather && <span>{WEATHER_NAMES[entry.weather]}</span>}
        {entry.isReview && <span>Weekly review</span>}
      </div>
      {entry.prompt && <div className="q">{entry.prompt}</div>}
      {mode === "edit" ? (
        <form onSubmit={(event) => { event.preventDefault(); save(draft); }}>
          <textarea aria-label="Edit logbook entry" autoFocus required maxLength={8000} value={draft} disabled={pending} onChange={(event) => setDraft(event.target.value)} />
          <div className="actions">
            <button className="btn" disabled={pending || !draft.trim() || draft.trim() === original}>Save changes</button>
            <button className="link" type="button" onClick={close} disabled={pending}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <p>{entry.body}</p>
          {mode === "delete" ? (
            <div>
              <p>Delete this logbook entry? This is permanent.</p>
              <div className="actions">
                <button className="btn ghost" autoFocus onClick={close} disabled={pending}>Keep entry</button>
                <button className="link" onClick={() => save(null)} disabled={pending}>Delete permanently</button>
              </div>
            </div>
          ) : !entry.isReview && (
            <div className="actions">
              <button className="link" ref={editButton} onClick={() => open("edit")}>Edit entry</button>
              <button className="link" ref={deleteButton} onClick={() => open("delete")}>Delete entry</button>
            </div>
          )}
        </>
      )}
      {mode !== "read" && submitted && error && <p className="error" role="alert">{error}</p>}
    </article>
  );
}
