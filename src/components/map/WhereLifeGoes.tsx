"use client";

import { useState } from "react";
import { formatMinutes } from "@/lib/copy";
import { ATTRIBUTES, ATTRIBUTE_NAMES } from "@/lib/game/types";
import type { MapView } from "@/lib/view";
import { AttrTag, attrColor, Swatch } from "../bits";

type Where = MapView["where"];

export function ShareBars({ rows }: { rows: Where["ranges"][number]["rows"] }) {
  return (
    <div className="share">
      {rows.map((r) => (
        <div className="share-row" key={r.attr}>
          <AttrTag attr={r.attr} />
          <div className="track">
            <i style={{ width: `${r.relative * 100}%`, background: attrColor(r.attr) }} />
          </div>
          <span className="v mono">
            {formatMinutes(Math.round(r.minutes))} · {Math.round(r.share * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}

export function WhereLifeGoes({ where }: { where: Where }) {
  const [key, setKey] = useState<"30" | "90" | "all">("90");
  const range = where.ranges.find((r) => r.key === key)!;
  return (
    <section className="panel" aria-labelledby="where-h">
      <div className="panel-h">
        <h2 id="where-h">Where life goes</h2>
        <div className="seg" role="group" aria-label="Range">
          {where.ranges.map((r) => (
            <button key={r.key} aria-pressed={r.key === key} onClick={() => setKey(r.key)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <div className="label">Hours by attribute</div>
      <ShareBars rows={range.rows} />
      <p className="insight">{range.insight}</p>
      <div className="label" style={{ marginTop: 4 }}>
        Hours per week · last 12 weeks
      </div>
      <WeeklyChart weeks={where.weeks} />
    </section>
  );
}

export function WeeklyChart({ weeks }: { weeks: Where["weeks"] }) {
  const [active, setActive] = useState<number | null>(null);
  const W = weeks.length;
  const vw = 300, vh = 150, pl = 24, pb = 18, pt = 6;
  const cw = (vw - pl) / W, bw = cw - 6;
  const mx = Math.max(4, Math.ceil(Math.max(...weeks.map((w) => w.total)) / 4) * 4);
  const y = (v: number) => pt + (vh - pt - pb) * (1 - v / mx);
  const tipWeek = active === null ? null : weeks[active];
  const tipLeft = active === null ? 0 : ((pl + active * cw + cw / 2) / vw) * 100;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${vw} ${vh}`} role="img" aria-label="Stacked hours per week by attribute, last 12 weeks">
        {[0, mx / 2, mx].map((t) => (
          <g key={t}>
            <line x1={pl} x2={vw} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={t ? 0.5 : 1} />
            <text x={pl - 4} y={y(t) + 3} textAnchor="end">
              {t}h
            </text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const x = pl + i * cw + 3;
          const segs = ATTRIBUTES.filter((a) => w.hours[a] > 0);
          let base = 0;
          return (
            <g key={i}>
              {segs.map((a, j) => {
                const h = (vh - pt - pb) * (w.hours[a] / mx);
                const top = y(base + w.hours[a]);
                base += w.hours[a];
                return (
                  <rect
                    key={a}
                    x={x}
                    y={top}
                    width={bw}
                    height={Math.max(0, h - (j > 0 ? 1 : 0))}
                    fill={attrColor(a)}
                    rx={j === segs.length - 1 ? 2 : 0}
                  />
                );
              })}
              {(i % 3 === 0 || i === W - 1) && (
                <text x={x + bw / 2} y={vh - 4} textAnchor="middle">
                  {w.label}
                </text>
              )}
              <rect
                x={pl + i * cw}
                y={0}
                width={cw}
                height={vh}
                fill="transparent"
                tabIndex={0}
                aria-label={`${w.tipLabel}: ${w.total.toFixed(1)} hours`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              />
            </g>
          );
        })}
      </svg>
      {tipWeek && (
        <div className="tip" style={{ left: `clamp(70px, ${tipLeft}%, calc(100% - 70px))`, top: 8 }}>
          <b>{tipWeek.tipLabel}</b>
          {tipWeek.total > 0 ? (
            ATTRIBUTES.filter((a) => tipWeek.hours[a] > 0).map((a) => (
              <div key={a}>
                <span>
                  <Swatch attr={a} />
                  {ATTRIBUTE_NAMES[a]}
                </span>
                <span className="mono">{tipWeek.hours[a].toFixed(1)}h</span>
              </div>
            ))
          ) : (
            <div>Nothing logged</div>
          )}
        </div>
      )}
    </div>
  );
}
