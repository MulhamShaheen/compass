"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateSettings } from "@/lib/actions/profile";
import { setQuestStatus } from "@/lib/actions/quests";
import { completeWeeklyReview } from "@/lib/actions/review";
import { ATTRIBUTES, ATTRIBUTE_NAMES, type Attribute } from "@/lib/game/types";
import type { ReviewView } from "@/lib/view";
import { AttrTag, Chip } from "./bits";
import { useAction } from "./Toast";

export function ReviewQuests({ quests, slots, sideUnlocked }: Pick<ReviewView, "quests" | "slots" | "sideUnlocked">) {
  const { go, pending, error } = useAction();
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {quests.length === 0 && <p className="empty">No open quests. Begin one from the map.</p>}
      {quests.map((q) => (
        <div className="qmini" key={q.id}>
          <div style={{ display: "grid", gap: 4 }}>
            <b>{q.title}</b>
            <span style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, color: "var(--muted)" }}>
              {q.attrs.map((a) => (
                <AttrTag key={a} attr={a} />
              ))}
              <span>{q.last ? `Last: ${q.last.rel}` : "No checkpoints yet"}</span>
            </span>
          </div>
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Chip type={q.type} status={q.status} />
            <button
              className="btn ghost"
              disabled={pending}
              onClick={() => go(() => setQuestStatus({ questId: q.id, status: q.status === "active" ? "paused" : "active" }))}
            >
              {q.status === "active" ? "Pause" : "Resume"}
            </button>
          </span>
        </div>
      ))}
      {error && <p className="error">{error}</p>}
      <p className="slotnote">
        Main {slots.main.used} of {slots.main.max}
        {sideUnlocked ? ` · side ${slots.side.used} of ${slots.side.max}` : ""}. <Link className="link" href="/">Begin a new quest on the map</Link>
      </p>
    </div>
  );
}

export function ReviewFinish({ baseline }: { baseline: ReviewView["baseline"] }) {
  const router = useRouter();
  const { go, pending, error } = useAction();
  const [note, setNote] = useState("");
  const [rerate, setRerate] = useState(false);
  const [ratings, setRatings] = useState<Partial<Record<Attribute, number>>>({});
  return (
    <form
      style={{ display: "grid", gap: 12 }}
      onSubmit={(e) => {
        e.preventDefault();
        go(() => completeWeeklyReview({ note, ratings: rerate ? ratings : {} }), () => router.push("/"));
      }}
    >
      <div className="prompt">What will next week be about?</div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="A few lines. It goes into your logbook." aria-label="Next week" />
      <label className="check">
        <input type="checkbox" checked={rerate} onChange={(e) => setRerate(e.target.checked)} /> Rate the five attributes again (optional)
      </label>
      {rerate && (
        <div className="rate">
          {ATTRIBUTES.map((a) => (
            <div className="rate-row" key={a}>
              <div className="t">
                <AttrTag attr={a} />
                {baseline[a] && <small>last time {baseline[a]}/5</small>}
              </div>
              <div className="scale" role="group" aria-label={`${ATTRIBUTE_NAMES[a]} rating`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" aria-pressed={ratings[a] === n} onClick={() => setRatings((r) => ({ ...r, [a]: n }))}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <div>
        <button className="btn" type="submit" disabled={pending}>
          Finish the review
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

export function SettingsForm(props: { characterName: string; chapterTitle: string; timezone: string; quietMode: boolean }) {
  const { go, pending, error } = useAction();
  const [characterName, setName] = useState(props.characterName);
  const [chapterTitle, setChapter] = useState(props.chapterTitle);
  const [timezone, setTz] = useState(props.timezone);
  const [quietMode, setQuiet] = useState(props.quietMode);
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        go(() => updateSettings({ characterName, chapterTitle, timezone, quietMode }));
      }}
    >
      <label className="field">
        <span>Character name</span>
        <input type="text" value={characterName} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        <span>Chapter</span>
        <input type="text" value={chapterTitle} onChange={(e) => setChapter(e.target.value)} />
      </label>
      <label className="field">
        <span>Timezone</span>
        <input type="text" value={timezone} onChange={(e) => setTz(e.target.value)} />
        <small>
          &ldquo;Today&rdquo; and weeks (Monday to Sunday) are counted here, for example Europe/Berlin.
        </small>
      </label>
      <label className="check">
        <input type="checkbox" checked={quietMode} onChange={(e) => setQuiet(e.target.checked)} />
        <span>
          Quiet mode
          <br />
          <small className="muted">Hides Character and Where life goes, so only Today, quests and the logbook remain.</small>
        </span>
      </label>
      <div>
        <button className="btn" type="submit" disabled={pending}>
          Save settings
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
