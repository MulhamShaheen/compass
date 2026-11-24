import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { parseIcsFeed } from "../../src/lib/calendar/ics";
import { storedEvent } from "../../src/lib/calendar/records";
import { buildSample } from "../../src/lib/dev/sample";
import { addDays, dayKey, weekStart } from "../../src/lib/time";

test("calendar time and event rules lead to one confirmed quest checkpoint", async ({ page, context }, testInfo) => {
  const dataFile = testInfo.config.webServer?.env?.COMPASS_DATA_FILE;
  test.skip(testInfo.config.webServer?.env?.COMPASS_STORE !== "local", "This fixture uses the local file store.");
  if (!dataFile) {
    throw new Error("Calendar fixtures require Playwright's local test data file.");
  }
  const calendarFile = dataFile + ".calendar.json";
  const now = new Date();
  const monday = weekStart(dayKey(now, "UTC"));
  const sourceId = randomUUID();
  const eventTitle = "Evening club run";
  const dismissedTitle = "Morning club run";
  const sample = buildSample(now, "UTC");
  const quest = sample.quests.find((q) => q.title === "Run a 10K")!;
  const occurrence = (title: string, day: string) => {
    const date = day.replaceAll("-", "");
    return [
      "BEGIN:VEVENT", "UID:" + randomUUID(), "SUMMARY:" + title,
      "DTSTART:" + date + "T100000Z", "DTEND:" + date + "T110000Z", "END:VEVENT",
    ].join("\r\n");
  };
  const feed = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Compass//E2E//EN",
    occurrence(eventTitle, addDays(monday, -1)), occurrence(dismissedTitle, addDays(monday, -2)),
    occurrence("Team catch-up", monday), "END:VCALENDAR",
  ].join("\r\n");
  const snapshot = {
    sources: [{ id: sourceId, name: "Training calendar", kind: "ics", lastSyncedAt: now.toISOString(), secret: "https://example.com/training.ics", cursor: "private-sync-cursor", version: 1 }],
    events: parseIcsFeed(feed, now, "UTC").map((event) => storedEvent(sourceId, event)),
    rules: [], wakingStart: "07:00", wakingEnd: "23:00",
  };
  // Seed only Playwright's private local files. Exercise rules, settings and confirmation through the browser.
  await mkdir(dirname(dataFile), { recursive: true });
  await writeFile(dataFile, JSON.stringify(sample));
  await writeFile(calendarFile, JSON.stringify(snapshot));
  try {
    await page.goto("/calendar");
    const time = page.getByRole("table", { name: "Daily busy and free waking time" });
    await expect(time.getByRole("row")).toHaveCount(8);
    await expect(time.getByRole("row").nth(1)).toContainText("15h");
    await expect(page.getByText("111h free this week")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

    await page.getByLabel("Wake up").fill("08:00");
    await page.getByLabel("End of waking day").fill("18:00");
    await page.getByRole("button", { name: "Save hours" }).click();
    await expect(page.getByText("69h free this week")).toBeVisible();
    await expect(page.getByText(eventTitle)).toHaveCount(0);

    await page.getByLabel("Title contains").fill("club run");
    await page.getByLabel("Suggest a checkpoint for").selectOption({ label: quest.title });
    await page.getByRole("button", { name: "Preview matches" }).click();
    const preview = page.getByRole("region", { name: "Recent matches" });
    await expect(preview.getByRole("listitem").first()).toContainText(eventTitle);
    await expect(preview).toContainText(dismissedTitle);
    await expect(page.getByRole("button", { name: "Log checkpoint" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remove rule for club run" })).toHaveCount(0);
    await page.getByRole("button", { name: "Add rule" }).click();
    await expect(preview).toHaveCount(0);
    const event = page.locator("#suggestions li").filter({ has: page.getByText(eventTitle, { exact: true }) });
    await event.getByText("Why this was suggested").click();
    await expect(event.getByText("“club run” → " + quest.title)).toBeVisible();
    await page.getByRole("button", { name: "Dismiss " + dismissedTitle }).click();
    await expect(page.locator("#suggestions").getByText(dismissedTitle)).toHaveCount(0);
    await page.reload();
    await expect(page.locator("#suggestions").getByText(dismissedTitle)).toHaveCount(0);
    await expect(page.getByText(eventTitle)).toBeVisible();
    const scan = await new AxeBuilder({ page }).include(".calendar-page")
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(scan.violations).toEqual([]);
    const otherTab = await context.newPage();
    await otherTab.goto("/calendar");
    await expect(otherTab.getByText(eventTitle)).toBeVisible();
    const confirm = { name: "Log checkpoint", exact: true };
    await page.getByRole("button", confirm).click();
    await expect(page.getByRole("button", confirm)).toHaveCount(0);
    // A second tab still showing the old suggestion may submit it again.
    await otherTab.getByRole("button", confirm).click();
    await expect(otherTab.getByRole("button", confirm)).toHaveCount(0);
    await otherTab.close();

    const exported = await page.request.get("/api/export");
    expect(exported.ok()).toBe(true);
    const download = await exported.json();
    expect(download.calendar.sources).toEqual([
      { id: sourceId, name: "Training calendar", kind: "ics", lastSyncedAt: now.toISOString() },
    ]);
    expect(download.calendar.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ title: eventTitle, sourceId }),
    ]));
    expect(download.calendar.dismissedIds).toEqual(
      snapshot.events.filter((event) => event.title === dismissedTitle).map(({ id }) => id),
    );
    const json = JSON.stringify(download);
    expect(json).not.toContain(snapshot.sources[0].secret);
    expect(json).not.toContain(snapshot.sources[0].cursor);

    await page.getByRole("button", { name: "Disconnect", exact: true }).click();
    await page.getByRole("button", { name: "Confirm disconnect" }).click();
    await expect(page.getByText("Training calendar")).toHaveCount(0);
    await page.goto("/quests/" + quest.id);
    await expect(page.getByRole("heading", { name: eventTitle })).toHaveCount(1);
    const persisted: typeof sample = JSON.parse(await readFile(dataFile, "utf8"));
    expect(persisted.checkpoints.filter((cp) => cp.source === "calendar")).toMatchObject([
      { title: eventTitle, minutes: 60, questId: quest.id },
    ]);
  } finally {
    await rm(calendarFile, { force: true });
  }
});
