"use client";

import { useState } from "react";
import { useAction } from "@/components/Toast";
import { sendMagicLink } from "@/lib/actions/auth";

export function LoginForm() {
  const { go, pending, error } = useAction();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (sentTo) {
    return (
      <div className="step-body" role="status">
        <p className="lede">
          Link sent to <b style={{ color: "var(--accent)" }}>{sentTo}</b>. Open it in this browser to continue. It works once.
        </p>
        <div>
          <button className="link" type="button" onClick={() => setSentTo(null)}>
            Use another email
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="step-body"
      onSubmit={(e) => {
        e.preventDefault();
        if (!email.trim()) return;
        go(() => sendMagicLink({ email }), () => setSentTo(email.trim().toLowerCase()));
      }}
    >
      <input
        type="text"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        aria-label="Email address"
        autoFocus
      />
      {error && <p className="error">{error}</p>}
      <div>
        <button className="btn" type="submit" disabled={pending || !email.trim()}>
          {pending ? "Sending" : "Send sign-in link"}
        </button>
      </div>
    </form>
  );
}
