import { SettingsForm } from "@/components/ReviewForms";
import { readDb } from "@/lib/db/local-store";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const db = readDb();
  const p = db.profile!;
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
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12, display: "grid", gap: 6 }}>
        <div className="label">Your data</div>
        <p className="insight">This is a diary. It belongs to you. Download everything as JSON at any time.</p>
        <div>
          <a className="btn ghost" href="/api/export" download>
            Export JSON
          </a>
        </div>
      </div>
    </main>
  );
}
