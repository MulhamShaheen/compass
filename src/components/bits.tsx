import { ATTRIBUTE_NAMES, type Attribute, type Weather } from "@/lib/game/types";

export const attrColor = (a: Attribute) => `var(--a-${a})`;

export function Swatch({ attr }: { attr: Attribute }) {
  return <span className="sw" style={{ background: attrColor(attr) }} />;
}

export function AttrTag({ attr, children }: { attr: Attribute; children?: React.ReactNode }) {
  return (
    <span className="atag">
      <Swatch attr={attr} />
      {children ?? ATTRIBUTE_NAMES[attr]}
    </span>
  );
}

export function Rose({ className = "rose" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="22" fill="none" stroke="var(--line)" strokeWidth="1.5" />
      <path d="M24 4 L28 24 L24 44 L20 24Z" fill="var(--brass)" />
      <path d="M24 4 L28 24 L20 24Z" fill="var(--ink)" />
      <path d="M4 24 L24 21 L44 24 L24 27Z" fill="var(--muted)" opacity=".5" />
      <circle cx="24" cy="24" r="2.5" fill="var(--panel)" stroke="var(--ink)" />
    </svg>
  );
}

const WEATHER_PATHS: Record<Weather, React.ReactNode> = {
  clear: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </>
  ),
  breezy: <path d="M3 9h11a3 3 0 1 0-3-3M3 15h15a3 3 0 1 1-3 3M3 12h8" />,
  cloudy: <path d="M7 18h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z" />,
  foggy: <path d="M4 9h16M6 13h12M4 17h16" />,
  stormy: (
    <>
      <path d="M7 15h10a4 4 0 0 0 0-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 15z" />
      <path d="m12 15-2 4h3l-2 4" />
    </>
  ),
};

export function WeatherIcon({ weather }: { weather: Weather }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {WEATHER_PATHS[weather]}
    </svg>
  );
}

export function LockedCard({ title, hint }: { title: string; hint: string }) {
  return (
    <section className="panel locked" aria-label={`${title}, locked`}>
      <div className="lockrow">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        <h2>{title}</h2>
      </div>
      <p>{hint}</p>
    </section>
  );
}

export function Chip({ type, status }: { type: "main" | "side" | "system"; status: "active" | "paused" | "done" }) {
  if (type === "system") return <span className="chip">Prologue</span>;
  const cls = status === "active" ? type : status;
  return <span className={`chip ${cls}`}>{status === "active" ? `${type} quest` : status}</span>;
}
