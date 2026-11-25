"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { archiveHabit, createHabit, createJournalEntry, setWeather, toggleHabit } from "@/lib/actions/daily";
import { dismissUnlock } from "@/lib/actions/profile";
import { reflectionQuestion } from "@/lib/game/daily";
import { WEATHERS, WEATHER_NAMES } from "@/lib/game/types";
import type { MapView } from "@/lib/view";
import { WeatherIcon } from "../bits";
import { Decode } from "../fx";
import { useAction } from "../Toast";
import { JournalCard } from "./JournalCard";
import { TodayNextStep } from "./TodayNextStep";

const STEPS = [
  ["checkin", "Morning check-in", "Set your inner weather below"],
  ["play", "Move a thread", "Log a checkpoint on any quest"],
  ["log", "Evening logbook", "Write one entry"],
] as const;

export function TodayPanel({ loop, weather, todayLabel, nextStep }: Pick<MapView, "loop" | "weather" | "nextStep"> & { todayLabel: string }) {
  const { go, pending } = useAction();
  return (
    <section className="panel" aria-labelledby="today-h">
      <div className="panel-h">
        <h2 id="today-h">Today</h2>
        <span className="label mono">{todayLabel}</span>
      </div>
      <div className="loop">
        {STEPS.map(([key, title, sub], i) => (
          <div key={key} className={`loopstep${loop[key] ? " done" : ""}`} data-testid={`loop-${key}`} data-done={loop[key]}>
            <span className="n">
              <span>{loop[key] ? "✓" : i + 1}</span>
            </span>
            <div>
              {title}
              <small>{key === "log" ? (
                <a className="link" href="#journal-body">{loop.log ? "Write another entry" : sub}</a>
              ) : sub}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="label">Inner weather</div>
      <div className="weather" role="group" aria-label="Inner weather">
        {WEATHERS.map((w) => (
          <button key={w} aria-pressed={weather === w} disabled={pending} onClick={() => go(() => setWeather({ weather: w }))}>
            <WeatherIcon weather={w} />
            {WEATHER_NAMES[w]}
          </button>
        ))}
      </div>
      <TodayNextStep key={nextStep.plan?.id ?? nextStep.quests[0]?.id} {...nextStep} />
    </section>
  );
}

export function HabitsPanel({ habits, slots, reviews }: { habits: MapView["habits"]; slots: number; reviews: number }) {
  const { go, pending, error } = useAction();
  const [name, setName] = useState("");
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [kind, setKind] = useState<"keep" | "starve">(habits.some((h) => h.kind === "keep") ? "starve" : "keep");
  const row = (h: MapView["habits"][number]) => (
    <div className={`habit${h.kind === "starve" ? " bad" : ""}`} key={h.id}>
      <div className="nm">
        {h.name}{" "}
        <small>
          {h.kind === "keep" ? (h.streak ? `· ${h.streak}-day streak` : "") : `· ${h.clean} clean days of 7`}
        </small>
        <button className="link put" id={`archive-${h.id}`} aria-expanded={archiveId === h.id} disabled={pending} onClick={() => setArchiveId(archiveId === h.id ? null : h.id)} aria-label={`Put away ${h.name}`}>
          put away
        </button>
      </div>
      <button
        className="tick"
        aria-pressed={h.doneToday}
        aria-label={`${h.kind === "keep" ? "Done today" : "Slipped today"}: ${h.name}`}
        disabled={pending}
        onClick={() => go(() => toggleHabit({ id: h.id }))}
      >
        {h.doneToday ? (h.kind === "keep" ? "✓" : "✕") : ""}
      </button>
      <div className="dots" aria-hidden="true">
        {h.strip.map((on, i) => (
          <i key={i} className={on ? "y" : ""} />
        ))}
      </div>
      {archiveId === h.id && (
        <div style={{ gridColumn: "1 / -1" }} role="group" aria-label={`Put away ${h.name}?`}>
          <p>Put away {h.name}? Your past check-ins stay in your history and the habit slot becomes available.</p>
          <div className="actions">
            <button type="button" className="btn ghost" disabled={pending} onClick={() => {
              setArchiveId(null);
              document.getElementById(`archive-${h.id}`)?.focus();
            }}>Keep tracking</button>
            <button type="button" className="link" disabled={pending} onClick={() => go(() => archiveHabit({ id: h.id }), () => {
              setArchiveId(null);
              document.getElementById("habits-h")?.focus();
            })}>Put away habit</button>
          </div>
        </div>
      )}
    </div>
  );
  const keep = habits.filter((h) => h.kind === "keep");
  const starve = habits.filter((h) => h.kind === "starve");
  return (
    <section className="panel" aria-labelledby="habits-h">
      <div className="panel-h">
        <h2 id="habits-h" tabIndex={-1}>Habits</h2>
        <span className="label">last 7 days</span>
      </div>
      <div className="habits">
        {habits.length === 0 && <p className="empty">Small things, done daily. Pick one to keep and one to starve.</p>}
        {keep.length > 0 && <div className="label">Keep</div>}
        {keep.map(row)}
        {starve.length > 0 && <div className="label">Starve</div>}
        {starve.map(row)}
      </div>
      {habits.length < slots && (
        <form
          className="addhabit"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            go(() => createHabit({ name, kind }), () => setName(""));
          }}
        >
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Morning walk" aria-label="Habit name" />
          <select value={kind} onChange={(e) => setKind(e.target.value as "keep" | "starve")} aria-label="Keep or starve">
            <option value="keep">Keep</option>
            <option value="starve">Starve</option>
          </select>
          <button className="btn" type="submit" disabled={pending || !name.trim()}>
            Add
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <p className="slotnote">
        {habits.length} of {slots} habit slots in use.{reviews === 0 ? " One to keep and one to starve for now." : ""} Each weekly review adds a slot.
      </p>
    </section>
  );
}

export function Logbook({ journal }: { journal: MapView["journal"] }) {
  const router = useRouter();
  const { go, pending, error } = useAction();
  const [offset, setOffset] = useState(0);
  const [body, setBody] = useState("");
  const [checkpointId, setCheckpointId] = useState<string | null>(null);
  const reflecting = checkpointId !== null;
  const selected = journal.reflectionCheckpoints.find((c) => c.id === checkpointId);
  const prompt = journal.prompts[(journal.startIndex + offset) % journal.prompts.length];
  return (
    <section className="panel" aria-labelledby="logbook-h">
      <div className="panel-h">
        <h2 id="logbook-h">Logbook</h2>
        <span className="label">diary &amp; reflection</span>
      </div>
      <div className="journal">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim() || (reflecting && !selected)) return;
            go(
              async () => {
                const result = await createJournalEntry(selected ? { body, checkpointId: selected.id } : { body, prompt });
                if (!result.ok && selected) router.refresh();
                return result;
              },
              () => {
                setBody("");
                setCheckpointId(null);
              },
            );
          }}
        >
          {reflecting && (
            <>
              <label className="reflection-checkpoint">
                <span className="label">Today’s checkpoint</span>
                <select value={selected?.id ?? ""} onChange={(e) => setCheckpointId(e.target.value)} disabled={pending} autoFocus>
                  {!selected && <option value="" disabled>This checkpoint is no longer available today</option>}
                  {journal.reflectionCheckpoints.map((c) => <option key={c.id} value={c.id}>{c.title} · {c.questTitle}</option>)}
                </select>
              </label>
              {journal.trueNorth && <div><span className="label">Your True North</span><p className="why">{journal.trueNorth}</p></div>}
            </>
          )}
          <div className="prompt" id="journal-prompt">{reflecting ? reflectionQuestion(journal.trueNorth) : prompt}</div>
          <textarea id="journal-body" value={body} onChange={(e) => setBody(e.target.value)} disabled={pending} placeholder="Write a few lines. Nobody grades this." aria-label="Logbook entry" aria-describedby="journal-prompt" />
          <div className="actions">
            <button className="btn" type="submit" disabled={pending || !body.trim() || (reflecting && !selected)}>
              Log entry
            </button>
            {reflecting ? (
              <button className="link" type="button" disabled={pending} onClick={() => setCheckpointId(null)}>Back to daily question</button>
            ) : (
              <>
                <button className="btn ghost" type="button" disabled={pending} onClick={() => setOffset((o) => o + 1)}>Another question</button>
                {journal.reflectionCheckpoints.length > 0 && (
                  <button className="link" type="button" disabled={pending} onClick={() => setCheckpointId(journal.reflectionCheckpoints[0].id)}>
                    Reflect on a checkpoint
                  </button>
                )}
              </>
            )}
          </div>
          {reflecting && error && <p className="error" role="alert">{error}</p>}
        </form>
        <div className="entries" role="region" aria-label="Saved entries" tabIndex={journal.entries.length ? 0 : -1}>
          {journal.entries.length === 0 && <p className="empty">Your entries will gather here.</p>}
          {journal.entries.map((entry) => <JournalCard entry={entry} key={entry.id} />)}
        </div>
      </div>
    </section>
  );
}

export function UnlockCards({ fresh }: { fresh: MapView["fresh"] }) {
  const { go, pending } = useAction();
  if (!fresh.length) return null;
  return (
    <div className="unlocks">
      {fresh.map((u) => (
        <div className="unlock" key={u.feature} role="status">
          <div>
            <span className="label">Unlocked</span>
            <h3>
              <Decode text={u.title} />
            </h3>
            <p>{u.body}</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {u.feature === "weekly_review" && (
              <Link className="btn" href="/review">
                Open the review
              </Link>
            )}
            {u.feature === "calendar" && (
              <Link className="btn" href="/calendar">Open Time</Link>
            )}
            <button className="btn ghost" disabled={pending} onClick={() => go(() => dismissUnlock({ feature: u.feature }))}>
              Got it
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
