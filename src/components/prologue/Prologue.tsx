"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { loadSample } from "@/lib/actions/dev";
import { completePrologue } from "@/lib/actions/prologue";
import {
  ATTRIBUTES,
  ATTRIBUTE_HINTS,
  ATTRIBUTE_NAMES,
  WEATHERS,
  WEATHER_NAMES,
  type Attribute,
  type Weather,
} from "@/lib/game/types";
import { AttrTag, Rose, WeatherIcon } from "../bits";
import { Decode } from "../fx";
import { useAction } from "../Toast";

const CHAPTERS = ["The Builder's Year", "Starting Over", "The Long Climb"];
const NORTH_EXAMPLES = [
  "Build things that matter, stay close to the people I love, and keep my body strong enough to enjoy it.",
  "Live slower, notice more, and leave every place a little better than I found it.",
  "Become someone my younger self would be proud of, one honest day at a time.",
];
const TEMPLATES: { title: string; attr: Attribute; why: string }[] = [
  { title: "Run a 10K", attr: "body", why: "Feel strong again." },
  {
    title: "Read 12 books",
    attr: "mind",
    why: "Keep the mind fed with more than feeds.",
  },
  {
    title: "Call family weekly",
    attr: "bonds",
    why: "They will not be here forever.",
  },
  {
    title: "Ship a side project",
    attr: "craft",
    why: "Finish something of my own.",
  },
  {
    title: "Start meditating",
    attr: "spirit",
    why: "Find a quiet corner in the day.",
  },
];
const STEPS = 5;

export function Prologue({ alreadyWritten }: { alreadyWritten: boolean }) {
  const router = useRouter();
  const { go, pending, error } = useAction();
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);

  const [name, setName] = useState("");
  const [chapter, setChapter] = useState("");
  const [north, setNorth] = useState("");
  const [ratings, setRatings] = useState<Partial<Record<Attribute, number>>>(
    {},
  );
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [a1, setA1] = useState<Attribute>("body");
  const [a2, setA2] = useState<Attribute | "">("");
  const [note, setNote] = useState("");
  const [weather, setWeather] = useState<Weather | null>(null);

  const next = () => setStep((s) => Math.min(STEPS, s + 1));
  const skip = () => {
    if (step === 1) {
      setName("");
      setChapter("");
    }
    if (step === 2) setNorth("");
    if (step === 3) setRatings({});
    if (step === 5) return finish(null);
    next();
  };
  const finish = (w: Weather | null) =>
    go(
      () =>
        completePrologue({
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          characterName: name,
          chapterTitle: chapter ? `Chapter 1 · ${chapter}` : "",
          trueNorth: north,
          ratings,
          quest: {
            title,
            why,
            primaryAttr: a1,
            secondaryAttr: a2 || null,
            note,
          },
          weather: w,
        }),
      () => setDone(true),
    );

  if (done) {
    return (
      <div className="story">
        <Rose />
        <h1>
          <Decode text="Your story starts today." />
        </h1>
        <p className="lede">
          {name ? `${name}, the` : "The"} map is quiet for now. More of it opens
          as you play.
        </p>
        <button className="btn" onClick={() => router.push("/")}>
          Open the map
        </button>
      </div>
    );
  }

  if (alreadyWritten) {
    return (
      <div className="story">
        <Rose />
        <h1>
          <Decode text="The Prologue is already written." />
        </h1>
        <button className="btn" onClick={() => router.push("/")}>
          Open the map
        </button>
      </div>
    );
  }

  return (
    <div className="pro">
      <div className="pro-top">
        <div className="row">
          <span className="label">{"// Character creation"}</span>
          <span className="label" style={{ color: "var(--muted)" }}>
            The Prologue · {step} of {STEPS}
          </span>
        </div>
        <div className="pdots" aria-hidden="true">
          {Array.from({ length: STEPS }, (_, i) => (
            <i
              key={i}
              className={i + 1 === step ? "on" : i + 1 < step ? "done" : ""}
            />
          ))}
        </div>
      </div>

      {step === 1 && (
        <div className="step-body" key={1}>
          <h1>
            <Decode text="Who are you?" />
          </h1>
          <p className="lede">
            A name for your character. It can be yours, or one you would like to
            grow into.
          </p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your character's name"
            aria-label="Character name"
            autoFocus
          />
          <div className="label">Name this chapter of your life (optional)</div>
          <div className="chips">
            {CHAPTERS.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={chapter === c}
                onClick={() => setChapter(chapter === c ? "" : c)}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={CHAPTERS.includes(chapter) ? "" : chapter}
            onChange={(e) => setChapter(e.target.value)}
            placeholder="Or write your own"
            aria-label="Chapter title"
          />
        </div>
      )}

      {step === 2 && (
        <div className="step-body" key={2}>
          <h1>
            <Decode text="Where are you heading?" />
          </h1>
          <p className="lede">
            One sentence of purpose. Your True North. Main quests should point
            at it. You can change it any time.
          </p>
          <textarea
            value={north}
            onChange={(e) => setNorth(e.target.value)}
            placeholder="I want to…"
            aria-label="True North"
            autoFocus
          />
          <div className="label">Some examples</div>
          <div className="examples">
            {NORTH_EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => setNorth(ex)}>
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="step-body" key={3}>
          <h1>
            <Decode text="Where do you stand?" />
          </h1>
          <p className="lede">
            How satisfied are you with each part of life today? This is a
            starting point, not a score.
          </p>
          <div className="rate">
            {ATTRIBUTES.map((a) => (
              <div className="rate-row" key={a}>
                <div className="t">
                  <AttrTag attr={a} />
                  <small>{ATTRIBUTE_HINTS[a]}</small>
                </div>
                <div
                  className="scale"
                  role="group"
                  aria-label={`${ATTRIBUTE_NAMES[a]} rating`}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={ratings[a] === n}
                      onClick={() => setRatings((r) => ({ ...r, [a]: n }))}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="step-body" key={4}>
          <h1>
            <Decode text="Your first quest." />
          </h1>
          <p className="lede">
            One main quest: a thread you want to follow for the next months.
            Pick one or write your own.
          </p>
          <div className="chips">
            {TEMPLATES.map((t) => (
              <button
                key={t.title}
                type="button"
                aria-pressed={title === t.title}
                onClick={() => {
                  setTitle(t.title);
                  setWhy(t.why);
                  setA1(t.attr);
                  setA2("");
                }}
              >
                <AttrTag attr={t.attr}>{t.title}</AttrTag>
              </button>
            ))}
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Quest name"
            aria-label="Quest name"
          />
          <input
            type="text"
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="Why it matters"
            aria-label="Why it matters"
          />
          <div className="chips" style={{ gap: 8 }}>
            <select
              value={a1}
              onChange={(e) => setA1(e.target.value as Attribute)}
              aria-label="Primary attribute"
            >
              {ATTRIBUTES.map((a) => (
                <option key={a} value={a}>
                  {ATTRIBUTE_NAMES[a]}
                </option>
              ))}
            </select>
            <select
              value={a2}
              onChange={(e) => setA2(e.target.value as Attribute | "")}
              aria-label="Secondary attribute"
            >
              <option value="">No second attribute</option>
              {ATTRIBUTES.filter((a) => a !== a1).map((a) => (
                <option key={a} value={a}>
                  + {ATTRIBUTE_NAMES[a]}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Where I stand today (optional)"
            aria-label="Where I stand today"
          />
          <p className="lede" style={{ fontSize: 13 }}>
            Compass adds the first checkpoint for you: “The quest begins”.
          </p>
        </div>
      )}

      {step === 5 && (
        <div className="step-body" key={5}>
          <h1>
            <Decode text="How’s the weather?" />
          </h1>
          <p className="lede">
            Your inner weather today. One tap, no explanation needed.
          </p>
          <div className="weather" role="group" aria-label="Inner weather">
            {WEATHERS.map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={weather === w}
                onClick={() => setWeather(w)}
              >
                <WeatherIcon weather={w} />
                {WEATHER_NAMES[w]}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <div className="pro-nav">
        {step > 1 ? (
          <button
            className="link"
            type="button"
            onClick={() => setStep((s) => s - 1)}
          >
            ← Back
          </button>
        ) : (
          <span />
        )}
        <div className="right">
          {step !== 4 && (
            <button
              className="btn ghost"
              type="button"
              disabled={pending}
              onClick={skip}
            >
              Skip for now
            </button>
          )}
          {step < STEPS ? (
            <button
              className="btn"
              type="button"
              disabled={step === 4 && !title.trim()}
              onClick={next}
            >
              Continue
            </button>
          ) : (
            <button
              className="btn"
              type="button"
              disabled={pending || !weather}
              onClick={() => finish(weather)}
            >
              Begin the story
            </button>
          )}
        </div>
      </div>

      {step === 1 && (
        <p
          className="slotnote"
          style={{ borderTop: "1px dashed var(--line)", paddingTop: 12 }}
        >
          Prototype: want to see a character months in?{" "}
          <button
            className="link"
            type="button"
            disabled={pending}
            onClick={() =>
              go(
                () =>
                  loadSample({
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                  }),
                () => router.push("/"),
              )
            }
          >
            Load sample character
          </button>
        </p>
      )}
    </div>
  );
}
