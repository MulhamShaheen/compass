import { expect, test } from "@playwright/test";

test("exports the signed-in character's data as JSON", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample character" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByRole("link", { name: /Launch Compass/ })).toBeVisible();

  const res = await page.request.get("/api/export");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toContain("compass-export.json");
  const data = await res.json();
  expect(data.profile.characterName).toBe("Sam");
  expect(data.quests.filter((q: { type: string }) => q.type !== "system")).toHaveLength(6);
  expect(data.checkpoints.length).toBeGreaterThan(20);
  expect(data).not.toHaveProperty("dev");
});
