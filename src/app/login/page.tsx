import { Rose } from "@/components/bits";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="prologue">
      <div className="pro login">
        <div className="pro-top">
          <div className="row">
            <span className="label">{"// Access"}</span>
            <span className="label" style={{ color: "var(--muted)" }}>
              Compass
            </span>
          </div>
        </div>
        <div className="step-body">
          <Rose />
          <h1>Sign in</h1>
          <p className="lede">Compass sends a one-time link to your email. No password to remember. New here? The same link creates your account.</p>
          {error === "link" && <p className="error">That link has expired or was already used. Send a new one.</p>}
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
