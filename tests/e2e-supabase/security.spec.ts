import { expect, test } from "@playwright/test";
import { APP, dbClient, readSessions, rest } from "./helpers";

const TABLES = [
  "profiles",
  "chapters",
  "quests",
  "checkpoints",
  "habits",
  "habit_logs",
  "weather_logs",
  "journal_entries",
  "attribute_ratings",
  "unlocks",
  "weekly_reviews",
  "today_next_steps",
  "compass_events",
  "prototype_state",
  "calendar_sources",
  "calendar_events",
  "calendar_rules",
  "calendar_dismissals",
];

test.describe("access rules", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("signed-out visitors are sent to sign in", async ({ page, request }) => {
    const res = await request.get(APP + "/", { maxRedirects: 0 });
    expect(res.status()).toBeGreaterThanOrEqual(300);
    expect(res.headers().location).toContain("/login");
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    const exp = await request.get(APP + "/api/export", { maxRedirects: 0 });
    expect(exp.status()).not.toBe(200);
  });

  test("each user only ever sees and changes their own rows", async () => {
    const s = readSessions();
    // A writes a quest and a checkpoint through the API, the way the app does.
    const quest = await rest("quests", s.a.token, {
      method: "POST",
      body: JSON.stringify({ type: "side", title: "A's secret quest", primary_attr: "mind" }),
    });
    expect(quest.status).toBe(201);
    const questId = (quest.body as { id: string }[])[0].id;
    const cp = await rest("checkpoints", s.a.token, {
      method: "POST",
      body: JSON.stringify({ quest_id: questId, title: "A's note", occurred_at: new Date().toISOString() }),
    });
    expect(cp.status).toBe(201);
    const event = {
      title: "Private event", starts_at: "2026-11-25T12:00:00Z", ends_at: "2026-11-25T13:00:00Z",
      quest_id: questId, checkpoint_id: (cp.body as { id: string }[])[0].id, attribute: "mind",
    };
    const added = await rest("compass_events", s.a.token, { method: "POST", body: JSON.stringify(event) });
    expect(added.status).toBe(201);
    const eventId = (added.body as { id: string }[])[0].id;
    const foreignEvent = await rest("compass_events", s.b.token, { method: "POST", body: JSON.stringify(event) });
    expect(foreignEvent.status).toBeGreaterThanOrEqual(400);

    // B reads nothing of A's in any table.
    for (const table of TABLES) {
      const r = await rest(`${table}?select=user_id`, s.b.token);
      expect(r.status, table).toBe(200);
      const rows = r.body as { user_id: string }[];
      expect(rows.every((row) => row.user_id === s.b.id), table).toBe(true);
    }
    // B cannot change or delete A's rows: the filters match nothing.
    const upd = await rest(`quests?id=eq.${questId}`, s.b.token, { method: "PATCH", body: JSON.stringify({ title: "hacked" }) });
    expect(upd.body).toEqual([]);
    const del = await rest(`checkpoints?quest_id=eq.${questId}`, s.b.token, { method: "DELETE" });
    expect(del.body).toEqual([]);
    // B cannot write rows in A's name, nor hang a checkpoint on A's quest.
    const forged = await rest("quests", s.b.token, {
      method: "POST",
      body: JSON.stringify({ user_id: s.a.id, type: "side", title: "forged", primary_attr: "mind" }),
    });
    expect(forged.status).toBeGreaterThanOrEqual(400);
    const hung = await rest("checkpoints", s.b.token, {
      method: "POST",
      body: JSON.stringify({ quest_id: questId, title: "on A's quest", occurred_at: new Date().toISOString() }),
    });
    expect(hung.status).toBeGreaterThanOrEqual(400);
    // Signed-out (publishable key only) sees nothing and cannot write.
    const anon = await rest("quests?select=id", null);
    expect(anon.body).toEqual([]);

    // A's data is untouched.
    const mine = await rest(`quests?id=eq.${questId}&select=title`, s.a.token);
    expect(mine.body).toEqual([{ title: "A's secret quest" }]);
    await rest(`quests?id=eq.${questId}`, s.a.token, { method: "DELETE" });
    expect((await rest(`compass_events?id=eq.${eventId}&select=quest_id,checkpoint_id`, s.a.token)).body)
      .toEqual([{ quest_id: null, checkpoint_id: null }]);
    await rest(`compass_events?id=eq.${eventId}`, s.a.token, { method: "DELETE" });
  });

  test("a next step is visible only to the person who planned it", async () => {
    const { a, b } = readSessions();
    const quest = await rest("quests", b.token, {
      method: "POST",
      body: JSON.stringify({ type: "main", title: "Practice piano", primary_attr: "craft" }),
    });
    expect(quest.status).toBe(201);
    const questId = (quest.body as { id: string }[])[0].id;
    try {
      const step = { id: crypto.randomUUID(), quest_id: questId, title: "Play one scale", day: "2026-11-24" };
      const saved = await rest("rpc/write_today_next_step", b.token, {
        method: "POST",
        body: JSON.stringify({ p_expected: null, p_step: step, p_checkpoint: null }),
      });
      expect(saved.status).toBe(200);
      expect(saved.body).toBe(true);
      const path = `today_next_steps?select=title&id=eq.${step.id}`;
      expect((await rest(path, b.token)).body).toEqual([{ title: step.title }]);
      expect((await rest(path, a.token)).body).toEqual([]);
    } finally {
      await rest(`quests?id=eq.${questId}`, b.token, { method: "DELETE" });
    }
  });

  test("a private calendar stays with its owner through sync, confirmation and disconnect", async () => {
    const { a, b } = readSessions();
    const admin = dbClient();
    await admin.connect();
    try {
      const connected = await admin.query("select calendar_connect($1,'ics','Test calendar',$2) id", [a.id, crypto.randomUUID()]);
      const source = connected.rows[0].id as string;
      const event = crypto.randomUUID();
      const dismissed = crypto.randomUUID();
      const events = [event, dismissed].map((id) => ({
        id, externalId: id, title: "Piano practice", start_time: "2025-01-10T10:00:00Z", end_time: "2025-01-10T11:00:00Z",
      }));
      const sync = () => admin.query("select calendar_sync_apply($1,$2,0,$3,'{}',true,null) applied", [a.id, source, JSON.stringify(events)]);
      expect((await sync()).rows[0].applied).toBe(true);
      expect((await sync()).rows[0].applied).toBe(false);
      const quest = await rest("quests", a.token, { method: "POST", body: JSON.stringify({ type: "side", title: "Practice", primary_attr: "craft" }) });
      expect(quest.status).toBe(201);
      const questId = (quest.body as { id: string }[])[0].id;
      const rule = await rest("calendar_rules", a.token, { method: "POST", body: JSON.stringify({ match_text: "piano", quest_id: questId }) });
      expect(rule.status).toBe(201);
      for (const table of ["calendar_sources", "calendar_events", "calendar_rules"]) {
        expect((await rest(table + "?user_id=eq." + a.id, b.token)).body).toEqual([]);
      }
      const rpc = (name: string, token: string, body: object) => rest("rpc/" + name, token, { method: "POST", body: JSON.stringify(body) });
      expect((await rpc("calendar_sync_read", a.token, { p_user: a.id, p_id: source })).status).toBeGreaterThanOrEqual(400);
      const confirm = (token: string, id = event) => rpc("calendar_confirm", token, { p_event: id, p_quest: questId });
      const dismiss = (token: string) => rpc("calendar_dismiss", token, { p_event: dismissed });
      expect((await dismiss(b.token)).status).toBeGreaterThanOrEqual(400);
      expect((await dismiss(a.token)).status).toBeLessThan(300);
      expect((await rest("calendar_dismissals?select=event_id", a.token)).body).toContainEqual({ event_id: dismissed });
      expect((await rest("calendar_dismissals?user_id=eq." + a.id, b.token)).body).toEqual([]);
      expect((await confirm(a.token, dismissed)).status).toBeGreaterThanOrEqual(400);
      expect((await confirm(b.token)).status).toBeGreaterThanOrEqual(400);
      for (const result of await Promise.all([confirm(a.token), confirm(a.token)])) expect(result.status).toBeLessThan(300);
      expect((await rest("calendar_sources?id=eq." + source, a.token, { method: "DELETE" })).status).toBeLessThan(300);
      expect((await rest("calendar_events?id=eq." + event, a.token)).body).toEqual([]);
      expect((await rest("calendar_dismissals?event_id=eq." + dismissed, a.token)).body).toEqual([]);
      expect((await rest("checkpoints?select=minutes&source_ref=eq." + event, a.token)).body).toEqual([{ minutes: 60 }]);
    } finally {
      await admin.end();
    }
  });
});

test.describe("delete account", () => {
  test.use({ storageState: "test-results/.auth/c.json" });

  test("removes the account and everything in it", async ({ page }) => {
    const s = readSessions();
    page.on("dialog", (d) => d.accept());
    await page.goto("/");
    await page.getByRole("button", { name: "Load sample character" }).click();
    await page.waitForURL((u) => u.pathname === "/");
    await page.goto("/settings");
    await page.getByRole("button", { name: "Delete account" }).click();
    await page.getByRole("button", { name: "Click again to delete everything" }).click();
    await page.waitForURL("**/login");

    const db = dbClient();
    await db.connect();
    try {
      const users = await db.query("select count(*)::int n from auth.users where id = $1", [s.c.id]);
      const quests = await db.query("select count(*)::int n from public.quests where user_id = $1", [s.c.id]);
      expect(users.rows[0].n).toBe(0);
      expect(quests.rows[0].n).toBe(0);
    } finally {
      await db.end();
    }
  });
});
