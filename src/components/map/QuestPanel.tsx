"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createQuest } from "@/lib/actions/quests";
import { ATTRIBUTES, ATTRIBUTE_NAMES, type Attribute } from "@/lib/game/types";
import type { MapView, QuestRowView } from "@/lib/view";
import { AttrTag, Chip } from "../bits";
import { useAction } from "../Toast";

type Filter = "active" | "main" | "side" | "done";
const FILTERS: [Filter, string][] = [
  ["active", "Active"],
  ["main", "Main"],
  ["side", "Side"],
  ["done", "Completed"],
];

function Pulse({ counts }: { counts: number[] }) {
  return (
    <div className="pulse" title="Checkpoints per week, last 16 weeks">
      {counts.map((v, i) => (
        <i key={i} className={v > 1 ? "on2" : v ? "on1" : ""} />
      ))}
    </div>
  );
}

function QuestRow({ q, index }: { q: QuestRowView; index: number }) {
  return (
    <Link
      href={`/quests/${q.id}`}
      className={`qrow ${q.type}`}
      style={{ textDecoration: "none", "--k": index } as React.CSSProperties}
    >
      <h3>{q.title}</h3>
      <Chip type={q.type} status={q.status} />
      <div className="meta">
        {q.attrs.map((a) => (
          <AttrTag key={a} attr={a} />
        ))}
        <span>Day {q.day}</span>
        <span>
          {q.checkpoints} checkpoint{q.checkpoints === 1 ? "" : "s"}
        </span>
        {q.last && (
          <span>
            Last: {q.last.title}, {q.last.rel}
          </span>
        )}
      </div>
      <Pulse counts={q.pulse} />
    </Link>
  );
}

export function QuestPanel({
  quests,
  slots,
  sideUnlocked,
  sideHint,
  prologueId,
}: {
  quests: QuestRowView[];
  slots: MapView["slots"];
  sideUnlocked: boolean;
  sideHint: string;
  prologueId: string | null;
}) {
  const [filter, setFilter] = useState<Filter>("active");
  const list = quests.filter((q) =>
    filter === "active" ? q.status !== "done" : filter === "done" ? q.status === "done" : q.type === filter && q.status !== "done",
  );
  return (
    <section className="panel" aria-labelledby="quests-h">
      <div className="panel-h">
        <h2 id="quests-h">Quest threads</h2>
        <div className="qfilter" role="group" aria-label="Filter quests">
          {FILTERS.filter(([f]) => sideUnlocked || f !== "side").map(([f, label]) => (
            <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="qlist">
        {list.length ? list.map((q, i) => <QuestRow key={q.id} q={q} index={i} />) : <p className="empty">No quests here yet.</p>}
      </div>
      <p className="slotnote">
        Slots: main {slots.main.used} of {slots.main.max}
        {sideUnlocked ? ` · side ${slots.side.used} of ${slots.side.max}` : ""}. Pausing a quest frees its slot.
        {prologueId && (
          <>
            {" "}
            <Link className="link" href={`/quests/${prologueId}`} style={{ fontSize: 12 }}>
              Read your Prologue
            </Link>
          </>
        )}
      </p>
      {!sideUnlocked && <p className="slotnote">Side quests: {sideHint.replace(/^Opens/, "open")}</p>}
      <NewQuestForm sideUnlocked={sideUnlocked} />
    </section>
  );
}

function NewQuestForm({ sideUnlocked }: { sideUnlocked: boolean }) {
  const router = useRouter();
  const { go, pending, error } = useAction();
  const [title, setTitle] = useState("");
  const [why, setWhy] = useState("");
  const [type, setType] = useState<"main" | "side">(sideUnlocked ? "side" : "main");
  const [a1, setA1] = useState<Attribute>("body");
  const [a2, setA2] = useState<Attribute | "">("");
  return (
    <form
      className="addq"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        go(
          () => createQuest({ title, why, type, primaryAttr: a1, secondaryAttr: a2 || null }),
          (r) => router.push(`/quests/${r.id}`),
        );
      }}
    >
      <div className="label">Begin a new quest</div>
      <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Quest name, e.g. Learn to cook for friends" aria-label="Quest name" />
      <input type="text" value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Why it matters (optional)" aria-label="Why it matters" />
      <div className="row">
        <select value={type} onChange={(e) => setType(e.target.value as "main" | "side")} aria-label="Quest type">
          {sideUnlocked && <option value="side">Side quest</option>}
          <option value="main">Main quest</option>
        </select>
        <select value={a1} onChange={(e) => setA1(e.target.value as Attribute)} aria-label="Primary attribute">
          {ATTRIBUTES.map((a) => (
            <option key={a} value={a}>
              {ATTRIBUTE_NAMES[a]}
            </option>
          ))}
        </select>
        <select value={a2} onChange={(e) => setA2(e.target.value as Attribute | "")} aria-label="Secondary attribute">
          <option value="">No second attribute</option>
          {ATTRIBUTES.filter((a) => a !== a1).map((a) => (
            <option key={a} value={a}>
              + {ATTRIBUTE_NAMES[a]}
            </option>
          ))}
        </select>
        <button className="btn" type="submit" disabled={pending || !title.trim()}>
          Begin quest
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
