"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { updateTrueNorth } from "@/lib/actions/profile";
import type { HeaderView } from "@/lib/view";
import { Rose } from "./bits";
import { LevelUp, Num, useProgressEvents } from "./fx";
import { useAction } from "./Toast";

export function Header({ view }: { view: HeaderView }) {
  const north = useRef<HTMLParagraphElement>(null);
  const { go } = useAction();
  const { gain, levelUp, dismiss } = useProgressEvents(view.level.level, view.total);
  const save = () => {
    const text = north.current?.textContent?.trim() ?? "";
    if (text !== view.trueNorth) go(() => updateTrueNorth({ trueNorth: text }));
  };
  return (
    <header>
      <div className="brand">
        <Rose />
        <div>
          <div className="sysline">
            <span className="live" aria-hidden="true" />
            <span>Online · Day {view.dayNumber}</span>
          </div>
          <h1 className="glitch" data-text="Compass">
            Compass
          </h1>
          <div className="chapter">
            {view.chapter}
            {view.name ? ` · ${view.name}` : ""}
          </div>
        </div>
      </div>
      <div className="north">
        <div className="label">True North</div>
        <p
          ref={north}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          aria-label="Your purpose statement, editable"
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
        >
          {view.trueNorth}
        </p>
      </div>
      <div className="lvl">
        <div className="lvlnum" aria-label={`Character level ${view.level.level}`}>
          <b data-testid="level">{view.level.level}</b>
          <small>LVL</small>
        </div>
        <span className="label">Character level</span>
        <div className="bar xpbar">
          <i style={{ width: `${view.level.progress * 100}%` }} />
        </div>
        <span className="label" style={{ color: "var(--muted)" }}>
          <Num value={view.level.into} /> / {view.level.step} XP to level {view.level.level + 1}
        </span>
        {gain && (
          <span key={gain.key} className="xp-pop" aria-hidden="true">
            +{gain.n} XP
          </span>
        )}
      </div>
      {levelUp !== null && <LevelUp level={levelUp} onDismiss={dismiss} />}
    </header>
  );
}

export function Nav({ reviewUnlocked }: { reviewUnlocked: boolean }) {
  const path = usePathname();
  const links: [string, string][] = [
    ["/", "The map"],
    ...(reviewUnlocked ? ([["/review", "Weekly review"]] as [string, string][]) : []),
    ["/how", "How it plays"],
    ["/settings", "Settings"],
  ];
  return (
    <nav className="tabs" aria-label="Sections">
      {links.map(([href, label]) => (
        <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
