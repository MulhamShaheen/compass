"use client";

import Link from "next/link";
import { useState } from "react";
import { archiveHabit, createHabit, createJournalEntry, setWeather, toggleHabit } from "@/lib/actions/daily";
import { dismissUnlock } from "@/lib/actions/profile";
import { WEATHERS, WEATHER_NAMES } from "@/lib/game/types";
import type { MapView } from "@/lib/view";
import { WeatherIcon } from "../bits";
import { Decode } from "../fx";
import { useAction } from "../Toast";

const STEPS = [
  ["checkin", "Morning check-in", "Set your inner weather below"],
  ["play", "Move a thread", "Log a checkpoint on any quest"],
  ["log", "Evening logbook", "Write one entry"],
] as const;

export function TodayPanel({ loop, weather, todayLabel }: Pick<MapView, "loop" | "weather"> & { todayLabel: string }) {
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
              <small>{sub}</small>
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
    </section>
  );
}

export function HabitsPanel({ habits, slots, reviews }: { habits: MapView["habits"]; slots: number; reviews: number }) {
  const { go, pending, error } = useAction();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"keep" | "starve">(habits.some((h) => h.kind === "keep") ? "starve" : "keep");
  const row = (h: MapView["habits"][number]) => (
    <div className={`habit${h.kind === "starve" ? " bad" : ""}`} key={h.id}>
      <div className="nm">
        {h.name}{" "}
        <small>
          {h.kind === "keep" ? (h.streak ? `· ${h.streak}-day streak` : "") : `· ${h.clean} clean days of 7`}
        </small>
        <button className="link put" onClick={() => go(() => archiveHabit({ id: h.id }))} aria-label={`Put away ${h.name}`}>
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
    </div>
  );
  const keep = habits.filter((h) => h.kind === "keep");
  const starve = habits.filter((h) => h.kind === "starve");
  return (
    <section className="panel" aria-labelledby="habits-h">
      <div className="panel-h">
        <h2 id="habits-h">Habits</h2>
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
  const { go, pending } = useAction();
  const [offset, setOffset] = useState(0);
  const [body, setBody] = useState("");
  const prompt = journal.prompts[(journal.startIndex + offset) % journal.prompts.length];
  return (
    <section className="panel" aria-labelledby="logbook-h">
      <div className="panel-h">
        <h2 id="logbook-h">Logbook</h2>
        <span className="label">diary &amp; reflection</span>
      </div>
      <div className="journal">
        <form
          style={{ display: "grid", gap: 10 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return;
            go(() => createJournalEntry({ body, prompt }), () => setBody(""));
          }}
        >
          <div className="prompt">{prompt}</div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a few lines. Nobody grades this." aria-label="Logbook entry" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" type="submit" disabled={pending || !body.trim()}>
              Log entry
            </button>
            <button className="btn ghost" type="button" onClick={() => setOffset((o) => o + 1)}>
              Another question
            </button>
          </div>
        </form>
        <div className="entries">
          {journal.entries.length === 0 && <p className="empty">Your entries will gather here.</p>}
          {journal.entries.map((j) => (
            <div className="entry" key={j.id}>
              <div className="meta">
                <span className="mono">{j.day}</span>
                {j.weather && <span>{WEATHER_NAMES[j.weather]}</span>}
              </div>
              {j.prompt && <div className="q">{j.prompt}</div>}
              <p>{j.body}</p>
            </div>
          ))}
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
            <button className="btn ghost" disabled={pending} onClick={() => go(() => dismissUnlock({ feature: u.feature }))}>
              Got it
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
