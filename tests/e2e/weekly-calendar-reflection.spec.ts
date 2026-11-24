import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { expect, test } from "@playwright/test";
import { buildSample } from "../../src/lib/dev/sample";
import { reviewWeekFor } from "../../src/lib/game/daily";
import { addDays, dayKey, daysBetween } from "../../src/lib/time";

test("the weekly review reflects on calendar time and saves an idea to the logbook", async ({ page }, testInfo) => {
  const env = testInfo.config.webServer?.env;
  test.skip(env?.COMPASS_STORE !== "local", "This fixture uses the local file store.");
  const dataFile = env?.COMPASS_DATA_FILE;
  if (!dataFile) throw new Error("The local test store needs a data file.");

  const calendarFile = dataFile + ".calendar.json";
  const now = new Date();
  const today = dayKey(now, "UTC");
  const week = reviewWeekFor(today);
  const completedDays = Math.min(7, daysBetween(week, today));
  const sample = buildSample(now, "UTC");
  sample.reviews = sample.reviews.filter((review) => review.weekStart !== week);

  const sourceId = randomUUID();
  const fixtureEvent = (title: string, start: string, end: string) => ({
    id: randomUUID(), sourceId, externalId: randomUUID(), title, start, end,
  });
  const calendar = {
    sources: [{
      id: sourceId, name: "Training", kind: "ics", lastSyncedAt: now.toISOString(),
      secret: "https://example.com/training.ics", cursor: null, version: 1,
    }],
    events: [
      fixtureEvent("Private practice", week + "T10:00:00Z", week + "T12:00:00Z"),
      fixtureEvent("Today’s calendar", today + "T00:00:00Z", addDays(today, 1) + "T00:00:00Z"),
    ],
    rules: [], wakingStart: "07:00", wakingEnd: "23:00",
  };
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, JSON.stringify(sample));
  await writeFile(calendarFile, JSON.stringify(calendar));

  try {
    await page.goto("/review");
    await expect(page.getByRole("heading", { name: "Calendar reflection" })).toBeVisible();
    await expect(page.getByText(`${16 * completedDays - 2}h free`, { exact: true })).toBeVisible();
    await expect(page.getByText("Private practice")).toHaveCount(0);
    const note = "My free time felt easier to use in the mornings.";
    const idea = "Try one short run before work.";
    await page.getByLabel("Next week", { exact: true }).fill(note);
    await page.getByLabel("Next checkpoint idea (optional)").fill(idea);
    await page.getByRole("button", { name: "Finish the review" }).click();
    await page.waitForURL((url) => url.pathname === "/");
    await expect(page.getByText("Next checkpoint idea — " + idea)).toBeVisible();

    const exported = await page.request.get("/api/export");
    expect(exported.ok()).toBe(true);
    const data = await exported.json() as typeof sample;
    const saved = note + "\n\nNext checkpoint idea — " + idea;
    expect(data.reviews).toContainEqual(expect.objectContaining({ weekStart: week, note: saved }));
    expect(data.journal).toContainEqual(expect.objectContaining({ body: saved }));
    expect(data.checkpoints.filter((checkpoint) => checkpoint.source !== "system")).toHaveLength(
      sample.checkpoints.filter((checkpoint) => checkpoint.source !== "system").length,
    );
  } finally {
    await rm(calendarFile, { force: true });
  }
});
