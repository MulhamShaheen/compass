import { expect, test, type Page } from "@playwright/test";

const nextDay = async (page: Page) => {
  const day = await page.getByText(/Day \d+/).first().textContent();
  await page.getByRole("button", { name: "Next day" }).click();
  await expect(page.getByText(/Day \d+/).first()).not.toHaveText(day!);
};

test.beforeEach(async ({ page }) => {
  // Start from an empty character via the dev tools.
  page.on("dialog", (d) => d.accept());
  await page.goto("/");
  if (!page.url().endsWith("/prologue")) {
    await page.getByRole("button", { name: "Start over" }).click();
    await page.waitForURL("**/prologue");
  }
});

test("a new character plays the Prologue, then the map opens over the first week", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Who are you?" })).toBeVisible();
  await page.getByLabel("Character name").fill("Robin");
  await page.getByRole("button", { name: "Starting Over" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Where are you heading?" })).toBeVisible();
  await page.getByRole("button", { name: "Skip for now" }).click();

  await page.getByRole("group", { name: "Body rating" }).getByRole("button", { name: "2" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  // Step 4 cannot be skipped.
  await expect(page.getByRole("button", { name: "Skip for now" })).toHaveCount(0);
  await page.getByRole("button", { name: "Run a 10K" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByRole("button", { name: "Breezy" }).click();
  await page.getByRole("button", { name: "Begin the story" }).click();
  await expect(page.getByRole("heading", { name: "Your story starts today." })).toBeVisible();
  await page.getByRole("button", { name: "Open the map" }).click();

  // Day 1: only header, Today, the one quest and the logbook. The rest is locked.
  await expect(page.getByText("Chapter 1 · Starting Over · Robin")).toBeVisible();
  await expect(page.getByRole("link", { name: /Run a 10K/ })).toBeVisible();
  await expect(page.getByLabel("Habits, locked")).toBeVisible();
  await expect(page.getByLabel("Character, locked")).toBeVisible();
  await expect(page.getByLabel("Where life goes, locked")).toBeVisible();
  await expect(page.getByTestId("loop-checkin")).toHaveAttribute("data-done", "true");
  // "The quest begins" is added by the app, so it does not count as moving a thread.
  await expect(page.getByTestId("loop-play")).toHaveAttribute("data-done", "false");

  // A second main quest does not fit in the slot.
  await page.getByLabel("Quest name").fill("Learn Spanish");
  await page.getByRole("button", { name: "Begin quest" }).click();
  await expect(page.locator(".addq .error")).toContainText("main quest slot is taken");

  // Move the thread: an hour-long milestone earns 35 points.
  await page.getByRole("link", { name: /Run a 10K/ }).click();
  await page.getByLabel("Checkpoint title").fill("First run in years");
  await page.getByLabel("Milestone").check();
  await expect(page.getByTestId("earns")).toHaveText("Earns 35 Body");
  await page.getByRole("button", { name: "Log checkpoint" }).click();
  await expect(page.getByRole("heading", { name: "First run in years" })).toBeVisible();
  await expect(page.getByTestId("quest-points")).toHaveText("37");

  // Write in the logbook: completes the loop and unlocks rotating prompts.
  await page.getByRole("link", { name: "← All quests" }).click();
  await page.getByLabel("Logbook entry").fill("Tired, in a good way.");
  await page.getByRole("button", { name: "Log entry" }).click();
  await expect(page.getByText("Tired, in a good way.")).toBeVisible();
  await expect(page.getByTestId("loop-log")).toHaveAttribute("data-done", "true");
  await expect(page.getByTestId("loop-play")).toHaveAttribute("data-done", "true");

  // Day 2: a second check-in opens habits.
  await nextDay(page);
  await expect(page.getByTestId("loop-checkin")).toHaveAttribute("data-done", "false");
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByRole("heading", { name: "Habits", exact: true }).first()).toBeVisible();
  await page.getByLabel("Habit name").fill("Morning walk");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Done today: Morning walk" }).click();
  await expect(page.getByRole("button", { name: "Done today: Morning walk" })).toHaveAttribute("aria-pressed", "true");

  // Days 3 and 4: side quests open by time.
  await nextDay(page);
  await nextDay(page);
  await expect(page.getByRole("button", { name: "Side", exact: true })).toBeVisible();

  // Day 7: where life goes and the weekly review open; the review adds a habit slot.
  await nextDay(page);
  await nextDay(page);
  await nextDay(page);
  await expect(page.getByRole("heading", { name: "Where life goes", level: 2 })).toBeVisible();
  await page.getByRole("link", { name: "Weekly review" }).first().click();
  await page.getByLabel("Next week").fill("More runs, earlier nights.");
  await page.getByRole("button", { name: "Finish the review" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByText(/of 3 habit slots in use/)).toBeVisible();

  // The Prologue quest tells the story of how it started.
  await page.getByRole("link", { name: "Read your Prologue" }).click();
  await expect(page.getByRole("heading", { name: "The story starts today" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Unlocked: Habits" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Weekly review · week of/ })).toBeVisible();
});

test("the sample character shows the full map", async ({ page }) => {
  await page.getByRole("button", { name: "Load sample character" }).click();
  await page.waitForURL((u) => u.pathname === "/");
  await expect(page.getByTestId("level")).toHaveText("2");
  await expect(page.getByRole("link", { name: /Launch Compass/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Character" })).toBeVisible();
  await expect(page.getByText(/took the most of your time in the last 90 days/)).toBeVisible();
  // No horizontal scroll at phone width.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
