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
          <p className="lede">Request a sign-in email to continue. New here? Your first sign-in creates your account.</p>
          {error === "link" && <p className="error" role="alert">That link could not sign you in. Request a fresh email from the app.</p>}
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
