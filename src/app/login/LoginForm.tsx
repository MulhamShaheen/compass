"use client";

import { useState } from "react";
import { useAction } from "@/components/Toast";
import { sendSignInCode, verifySignInCode } from "@/lib/actions/auth";

function CodeForm({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const { go, pending, error } = useAction();
  const [code, setCode] = useState("");
  return (
    <form className="step-body" onSubmit={(event) => {
      event.preventDefault();
      go(() => verifySignInCode({ email, code }));
    }}>
      <p className="lede">Enter the code sent to <strong>{email}</strong>.</p>
      <label htmlFor="sign-in-code">Sign-in code</label>
      <input
        id="sign-in-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6,10}"
        maxLength={10}
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
        disabled={pending}
        required
        autoFocus
      />
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button className="btn" type="submit" disabled={pending || code.length < 6}>
          {pending ? "Please wait…" : "Sign in"}
        </button>
        <button className="link" type="button" disabled={pending} onClick={() => go(
          () => sendSignInCode({ email }),
          () => setCode(""),
        )}>Send a new code</button>
        <button className="link" type="button" disabled={pending} onClick={onChangeEmail}>Use another email</button>
      </div>
    </form>
  );
}

function EmailForm({ initialEmail, onSent }: { initialEmail: string; onSent: (email: string) => void }) {
  const { go, pending, error } = useAction();
  const [email, setEmail] = useState(initialEmail);

  return (
    <form className="step-body" onSubmit={(event) => {
      event.preventDefault();
      const address = email.trim().toLowerCase();
      go(() => sendSignInCode({ email: address }), () => onSent(address));
    }}>
      <label htmlFor="sign-in-email">Email address</label>
      <input
        id="sign-in-email"
        type="email"
        inputMode="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        disabled={pending}
        required
        autoFocus
      />
      {error && <p className="error" role="alert">{error}</p>}
      <div>
        <button className="btn" type="submit" disabled={pending || !email.trim()}>
          {pending ? "Sending…" : "Send sign-in code"}
        </button>
      </div>
    </form>
  );
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [awaitingCode, setAwaitingCode] = useState(false);
  return awaitingCode
    ? <CodeForm email={email} onChangeEmail={() => setAwaitingCode(false)} />
    : <EmailForm initialEmail={email} onSent={(address) => { setEmail(address); setAwaitingCode(true); }} />;
}
