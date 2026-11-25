"use client";

import { useState } from "react";
import { disconnectGoogleEvents, publishEventToGoogle } from "@/lib/actions/google-events";
import { useAction } from "../Toast";

type Connection = { available: boolean; connected: boolean };

const connectionFeedback: Record<string, string> = {
  connected: "Google Calendar connected.",
  unavailable: "Google publishing is unavailable in this environment.",
  denied: "Google Calendar access was declined.",
  failed: "Could not connect Google Calendar. Try again.",
};

export function GooglePublishingConnection({ view, status }: { view: Connection; status?: string }) {
  const { go, pending, error } = useAction();
  const [confirming, setConfirming] = useState(false);
  const feedback = status && Object.hasOwn(connectionFeedback, status) ? connectionFeedback[status] : null;
  return (
    <section className="panel" aria-labelledby="google-publishing-h">
      <div className="panel-h"><h2 id="google-publishing-h">Google Calendar</h2></div>
      <p>Choose which events to send to your Compass Events calendar on Google.</p>
      {feedback && <p role="status">{feedback}</p>}
      {!view.available ? (
        <p>Google publishing is unavailable here. You can still download a calendar file.</p>
      ) : view.connected ? (
        confirming ? (
          <>
            <p>Disconnect Google Calendar? Events already on Google stay there.</p>
            <div className="actions">
              <button type="button" className="btn ghost" disabled={pending} onClick={() => setConfirming(false)}>Keep connected</button>
              <button type="button" className="link" disabled={pending} onClick={() => go(disconnectGoogleEvents, () => setConfirming(false))}>Disconnect</button>
            </div>
          </>
        ) : <button type="button" className="link" onClick={() => setConfirming(true)}>Disconnect Google Calendar</button>
      ) : <a className="btn" href="/api/events/google/start">Connect Google Calendar</a>}
      {error && confirming && <p className="error" role="alert">{error}</p>}
    </section>
  );
}

export function GoogleEventPublishing({ id, published }: { id: string; published: boolean }) {
  const { go, pending, error } = useAction();
  const [removing, setRemoving] = useState(false);
  return (
    <div>
      {published && removing ? (
        <div className="event-removal">
          <p>Remove this copy from Google Calendar? The event stays in Compass.</p>
          <div className="actions">
            <button type="button" className="btn ghost" autoFocus disabled={pending} onClick={() => setRemoving(false)}>Keep Google copy</button>
            <button type="button" className="link" disabled={pending} onClick={() => go(() => publishEventToGoogle(id, false), () => setRemoving(false))}>Remove Google copy</button>
          </div>
        </div>
      ) : (
        <div className="actions">
          <button type="button" className="link" disabled={pending} onClick={() => go(() => publishEventToGoogle(id, true))}>
            {published ? "Update on Google" : "Publish to Google"}
          </button>
          {published && <button type="button" className="link" disabled={pending} onClick={() => setRemoving(true)}>Remove from Google</button>}
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
