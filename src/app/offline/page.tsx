import { Rose } from "@/components/bits";

export const dynamic = "force-static";

/** Shown by the service worker when a page is opened without a connection. */
export default function OfflinePage() {
  return (
    <main className="prologue">
      <div className="pro">
        <div className="pro-top">
          <span className="label">{"// Signal lost"}</span>
        </div>
        <div className="step-body">
          <Rose />
          <h1>You are offline</h1>
          <p className="lede">Compass keeps your story on the server, not on this device. It will be here when the connection is back.</p>
          <div>
            {/* A full page load on purpose: it retries the network instead of the client router. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a className="btn" href="/">
              Try again
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
