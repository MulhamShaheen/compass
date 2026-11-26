"use client";

import { useState } from "react";
import { useAction } from "@/components/Toast";
import { sendSignInEmail, verifySignInCode, verifySignInLink } from "@/lib/actions/auth";

function VerifyForm({ email, onChangeEmail }: { email: string; onChangeEmail: () => void }) {
  const { go, pending, error } = useAction();
  const [codeMode, setCodeMode] = useState(false);
  const [value, setValue] = useState("");
  return (
    <form className="step-body" onSubmit={(event) => {
      event.preventDefault();
      go(() => codeMode ? verifySignInCode({ email, code: value }) : verifySignInLink(value));
    }}>
      <p className="lede">Check <strong>{email}</strong>. {codeMode ? "Enter the code from the email." : "Copy the link address in the email and paste it here to stay in Compass."}</p>
      <label htmlFor="sign-in-proof">{codeMode ? "Sign-in code" : "Sign-in link"}</label>
      <input
        key={String(codeMode)}
        id="sign-in-proof"
        type={codeMode ? "text" : "url"}
        inputMode={codeMode ? "numeric" : "url"}
        autoComplete={codeMode ? "one-time-code" : "off"}
        autoCapitalize="none"
        spellCheck={false}
        maxLength={codeMode ? 10 : 4096}
        value={value}
        onChange={(event) => setValue(codeMode ? event.target.value.replace(/\D/g, "") : event.target.value)}
        disabled={pending}
        required
        autoFocus
      />
      {error && <p className="error" role="alert">{error}</p>}
      <div className="actions">
        <button className="btn" type="submit" disabled={pending || value.trim().length < (codeMode ? 6 : 1)}>
          {pending ? "Please wait…" : "Sign in"}
        </button>
        <button className="link" type="button" disabled={pending} onClick={() => go(
          () => sendSignInEmail({ email }),
          () => setValue(""),
        )}>Send another email</button>
        <button className="link" type="button" disabled={pending} onClick={() => {
          setCodeMode(!codeMode);
          setValue("");
        }}>{codeMode ? "Paste a link instead" : "Enter a code instead"}</button>
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
      go(() => sendSignInEmail({ email: address }), () => onSent(address));
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
          {pending ? "Sending…" : "Send sign-in email"}
        </button>
      </div>
    </form>
  );
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [awaitingEmail, setAwaitingEmail] = useState(false);
  return awaitingEmail
    ? <VerifyForm email={email} onChangeEmail={() => setAwaitingEmail(false)} />
    : <EmailForm initialEmail={email} onSent={(address) => { setEmail(address); setAwaitingEmail(true); }} />;
}
