"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { updateTrueNorth } from "@/lib/actions/profile";
import type { HeaderView } from "@/lib/view";
import { Rose } from "./bits";
import { useAction } from "./Toast";

export function Header({ view }: { view: HeaderView }) {
  const north = useRef<HTMLParagraphElement>(null);
  const { go } = useAction();
  const save = () => {
    const text = north.current?.textContent?.trim() ?? "";
    if (text !== view.trueNorth) go(() => updateTrueNorth({ trueNorth: text }));
  };
  return (
    <header>
      <div className="brand">
        <Rose />
        <div>
          <h1>Compass</h1>
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
        <div className="lvlrow">
          <span className="label">Character level</span>
          <b className="mono" data-testid="level">
            {view.level.level}
          </b>
        </div>
        <div className="bar">
          <i style={{ width: `${view.level.progress * 100}%` }} />
        </div>
        <span className="label">
          {view.level.into} / {view.level.step} pts to level {view.level.level + 1}
        </span>
      </div>
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
