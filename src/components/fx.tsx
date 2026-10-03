"use client";

import { useEffect, useRef, useState } from "react";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/<>[]=+*";
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Text that resolves from scrambled glyphs, left to right, whenever it mounts or changes.
 * The real text is always available to assistive tech; the animation is aria-hidden.
 */
export function Decode({ text, duration = 650 }: { text: string; duration?: number }) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    if (reducedMotion()) {
      setOut(text);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const n = Math.floor(p * text.length);
      setOut(text.slice(0, n) + text.slice(n).replace(/\S/g, () => GLYPHS[(Math.random() * GLYPHS.length) | 0]));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, duration]);
  return (
    <>
      <span className="decode" aria-hidden="true">
        {out}
      </span>
      <span className="sr-only">{text}</span>
    </>
  );
}

/** A number that counts toward its new value when it changes (not on first render). */
export function Num({ value, testId, className }: { value: number; testId?: string; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (start === value || reducedMotion()) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 700);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span className={className} data-testid={testId}>
      {shown}
    </span>
  );
}

/** Watches the character level and total points; shows "+N XP" and a level-up moment. */
export function useProgressEvents(level: number, total: number) {
  const prev = useRef({ level, total });
  const [gain, setGain] = useState<{ n: number; key: number } | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = { level, total };
    if (total > before.total) setGain({ n: total - before.total, key: Date.now() });
    if (level > before.level) setLevelUp(level);
  }, [level, total]);
  useEffect(() => {
    if (levelUp === null) return;
    const t = setTimeout(() => setLevelUp(null), 2800);
    return () => clearTimeout(t);
  }, [levelUp]);
  return { gain, levelUp, dismiss: () => setLevelUp(null) };
}

export function LevelUp({ level, onDismiss }: { level: number; onDismiss: () => void }) {
  return (
    <div className="levelup" role="status" onClick={onDismiss}>
      <div className="band">
        <span className="label">Character</span>
        <div className="big">
          <Decode text="Level up" duration={500} />
        </div>
        <div className="sub">Level {level} reached · every thread you move counts</div>
      </div>
    </div>
  );
}

const THEMES = [
  { key: "dark", name: "Night City", note: "Neon on black. The default." },
  { key: "light", name: "Daylight", note: "Same HUD, light background." },
] as const;

/** Appearance is a per-device preference, stored in this browser only. */
export function ThemePicker() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);
  const choose = (t: "dark" | "light") => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem("compass-theme", t);
    } catch {
      /* storage may be blocked; the choice still applies for this visit */
    }
    setTheme(t);
  };
  return (
    <div className="themes" role="group" aria-label="Appearance">
      {THEMES.map((t) => (
        <button key={t.key} type="button" aria-pressed={theme === t.key} onClick={() => choose(t.key)}>
          <b>{t.name}</b>
          <small>{t.note}</small>
        </button>
      ))}
    </div>
  );
}

