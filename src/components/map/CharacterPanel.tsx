import { formatMinutes } from "@/lib/copy";
import { ATTRIBUTE_NAMES } from "@/lib/game/types";
import type { MapView } from "@/lib/view";
import { attrColor } from "../bits";
import { Num } from "../fx";

const CX = 140;
const CY = 118;
const R = 78;

function point(i: number, r: number): [number, number] {
  const a = (-90 + i * 72) * (Math.PI / 180);
  return [CX + Math.cos(a) * r, CY + Math.sin(a) * r];
}
const poly = (values: number[]) => values.map((v, i) => point(i, R * v).join(",")).join(" ");

/** The five attributes as a radar: logged points (relative to the strongest) and how you felt at the start. */
function Radar({ attributes }: { attributes: MapView["attributes"] }) {
  const scale = Math.max(150, ...attributes.map((a) => a.points));
  const logged = attributes.map((a) => Math.max(0.06, a.points / scale));
  const hasBaseline = attributes.some((a) => a.baseline);
  const baseline = attributes.map((a) => (a.baseline ?? 0) / 5);
  return (
    <>
      <svg className="radar" viewBox="0 0 280 236" role="img" aria-label="Attribute radar: where your points are">
        {[1 / 3, 2 / 3, 1].map((f) => (
          <polygon key={f} className="ring" points={poly([f, f, f, f, f])} />
        ))}
        {attributes.map((_, i) => {
          const [x, y] = point(i, R);
          return <line key={i} className="axis" x1={CX} y1={CY} x2={x} y2={y} />;
        })}
        {hasBaseline && <polygon className="base" points={poly(baseline)} />}
        <polygon className="shape" points={poly(logged)} />
        <g className="node">
          {attributes.map((a, i) => {
            const [x, y] = point(i, R * logged[i]);
            return <rect key={a.attr} x={x - 3} y={y - 3} width={6} height={6} fill={attrColor(a.attr)} transform={`rotate(45 ${x} ${y})`} />;
          })}
        </g>
        {attributes.map((a, i) => {
          const [x, y] = point(i, R + 20);
          const anchor = Math.abs(x - CX) < 4 ? "middle" : x > CX ? "start" : "end";
          return (
            <g key={a.attr}>
              <text x={x} y={y} textAnchor={anchor} fill={attrColor(a.attr)}>
                {ATTRIBUTE_NAMES[a.attr]}
              </text>
              <text className="lv" x={x} y={y + 12} textAnchor={anchor}>
                LV {a.level.level}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="radar-legend" aria-hidden="true">
        <span>
          <i /> Logged
        </span>
        {hasBaseline && (
          <span>
            <i className="base" /> Felt at the start
          </span>
        )}
      </div>
    </>
  );
}

export function CharacterPanel({ attributes }: { attributes: MapView["attributes"] }) {
  return (
    <section className="panel" aria-labelledby="character-h">
      <div className="panel-h">
        <h2 id="character-h">Character</h2>
        <span className="label">from quest progress</span>
      </div>
      <Radar attributes={attributes} />
      <div className="attrs">
        {attributes.map((a) => (
          <div className="attr" key={a.attr} style={{ "--c": attrColor(a.attr) } as React.CSSProperties}>
            <span className="lvbox" aria-label={`Level ${a.level.level}`}>
              {a.level.level}
            </span>
            <span className="nm" style={{ color: attrColor(a.attr) }}>
              {ATTRIBUTE_NAMES[a.attr]}
            </span>
            <span className="pts">
              <Num value={a.points} /> pts
            </span>
            <div className="bar">
              <i style={{ width: `${a.level.progress * 100}%`, background: attrColor(a.attr), color: attrColor(a.attr) }} />
            </div>
            <small>
              {a.activeQuests} active quest{a.activeQuests === 1 ? "" : "s"} · {formatMinutes(a.minutes)} logged
              {a.baseline ? ` · felt ${a.baseline}/5 at the start` : ""}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}
