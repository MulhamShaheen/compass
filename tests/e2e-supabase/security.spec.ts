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
  "prototype_state",
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
