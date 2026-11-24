"use client";

import Link from "next/link";

export default function CalendarError({ retry }: { retry: () => void }) {
  return (
    <main className="panel">
      <div className="panel-h"><h2>Time</h2></div>
      <p role="alert">Your calendar could not be loaded. Try again in a moment.</p>
      <div className="calendar-buttons">
        <button type="button" className="btn" onClick={retry}>Try again</button>
        <Link className="link" href="/">Return to the map</Link>
      </div>
    </main>
  );
}
