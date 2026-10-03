import { formatMinutes } from "@/lib/copy";
import { ATTRIBUTE_NAMES } from "@/lib/game/types";
import type { MapView } from "@/lib/view";
import { attrColor, Swatch } from "../bits";

export function CharacterPanel({ attributes }: { attributes: MapView["attributes"] }) {
  return (
    <section className="panel" aria-labelledby="character-h">
      <div className="panel-h">
        <h2 id="character-h">Character</h2>
        <span className="label">from quest progress</span>
      </div>
      <div className="attrs">
        {attributes.map((a) => (
          <div className="attr" key={a.attr}>
            <Swatch attr={a.attr} />
            <span className="nm">{ATTRIBUTE_NAMES[a.attr]}</span>
            <span className="mono label">
              Lv {a.level.level} · {a.points} pts
            </span>
            <div className="bar">
              <i style={{ width: `${a.level.progress * 100}%`, background: attrColor(a.attr) }} />
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
