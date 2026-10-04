/** Shown while a page loads its data from Supabase: the HUD frame, scanning. */
export default function Loading() {
  const panel = (lines: number, key: string) => (
    <section className="panel skel" key={key} aria-hidden="true">
      <i className="skel-h" />
      {Array.from({ length: lines }, (_, i) => (
        <i key={i} className="skel-line" style={{ width: `${92 - ((i * 17) % 40)}%` }} />
      ))}
    </section>
  );
  return (
    <main style={{ display: "grid", gap: 18 }} aria-busy="true">
      <p className="label skel-status" role="status">
        Syncing your story
      </p>
      <div className="board">
        <div className="col">
          {panel(6, "a")}
          {panel(4, "b")}
        </div>
        <div className="col col-quests">{panel(9, "c")}</div>
        <div className="col">
          {panel(4, "d")}
          {panel(3, "e")}
        </div>
      </div>
    </main>
  );
}
