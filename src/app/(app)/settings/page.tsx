import { ThemePicker } from "@/components/fx";
import { DeleteAccount, SettingsForm } from "@/components/ReviewForms";
import { deleteAccount, signOut } from "@/lib/actions/auth";
import { loadDbOrLogin } from "@/lib/db/store";
import { isLocalMode } from "@/lib/supabase/env";
import { currentUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const db = await loadDbOrLogin();
  const p = db.profile!;
  const user = isLocalMode() ? null : await currentUser();
  return (
    <main className="panel" style={{ maxWidth: 760, width: "100%", justifySelf: "center" }}>
      <div className="panel-h">
        <h2>Settings</h2>
      </div>
      <SettingsForm
        characterName={p.characterName ?? ""}
        chapterTitle={db.chapters.find((c) => !c.endedOn)?.title ?? ""}
        timezone={p.timezone}
        quietMode={p.quietMode}
      />
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "grid", gap: 8 }}>
        <div className="label">Appearance</div>
        <ThemePicker />
      </div>
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "grid", gap: 6 }}>
        <div className="label">Your data</div>
        <p className="insight">This is a diary. It belongs to you. Download everything as JSON at any time.</p>
        <div>
          <a className="btn ghost" href="/api/export" download>
            Export JSON
          </a>
        </div>
      </div>
      {user && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "grid", gap: 6 }}>
          <div className="label">Account</div>
          <p className="insight">Signed in as {user.email ?? "you"}.</p>
          <form action={signOut}>
            <button className="btn ghost" type="submit">
              Sign out
            </button>
          </form>
          <DeleteAccount deleteAccount={deleteAccount} />
        </div>
      )}
    </main>
  );
}
