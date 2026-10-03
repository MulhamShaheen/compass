"use client";

import { useRouter } from "next/navigation";
import { loadSample, resetClock, shiftClock, startOver } from "@/lib/actions/dev";
import { useAction } from "./Toast";

/** Prototype-only controls for manual testing. Remove when real accounts land. */
export function DevBar({ dayNumber, dayOffset, todayLabel }: { dayNumber: number; dayOffset: number; todayLabel: string }) {
  const { go, pending } = useAction();
  const router = useRouter();
  const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <div className="devbar" aria-label="Prototype tools">
      <span>
        Prototype · data stays on this machine · <b>Day {dayNumber}</b> ({todayLabel}
        {dayOffset ? `, clock +${dayOffset}d` : ""})
      </span>
      <button className="btn ghost" disabled={pending} onClick={() => go(() => shiftClock({ days: 1 }))}>
        Next day
      </button>
      {dayOffset > 0 && (
        <button className="btn ghost" disabled={pending} onClick={() => go(() => resetClock())}>
          Real time
        </button>
      )}
      <button className="btn ghost" disabled={pending} onClick={() => go(() => loadSample({ timezone: tz() }))}>
        Load sample character
      </button>
      <button
        className="btn ghost"
        disabled={pending}
        onClick={() => {
          if (confirm("Erase everything and start the Prologue again?")) go(() => startOver(), () => router.push("/prologue"));
        }}
      >
        Start over
      </button>
    </div>
  );
}
