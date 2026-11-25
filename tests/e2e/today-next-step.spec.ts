import { expect, test, type Page } from "@playwright/test";

const today = (page: Page) => page.getByRole("region", { name: "Today", exact: true });
const plan = "Walk to the park and jog one lap";

async function advanceDay(page: Page) {
  const day = page.getByLabel("Prototype tools").getByText(/^Day \d+$/);
  const before = await day.innerText();
  await page.getByRole("button", { name: "Next day" }).click();
  await expect(day).not.toHaveText(before);
}

async function planRun(page: Page) {
  const panel = today(page);
  await panel.getByRole("button", { name: "Choose a next step" }).click();
  await panel.getByLabel("Quest for next step").selectOption({ label: "Run a 10K" });
  await panel.getByRole("textbox", { name: "Next step", exact: true }).fill(plan);
  await panel.getByRole("button", { name: "Save next step" }).click();
  await expect(panel.getByText(plan, { exact: true })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample character" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sample character loaded" })).toBeVisible();
  // The sample already contains a checkpoint today. Begin on a fresh day.
  await advanceDay(page);
  await expect(page.getByTestId("loop-play")).toHaveAttribute("data-done", "false");
});

test("return to a saved step and log what actually happened on the chosen quest", async ({ page }) => {
  const panel = today(page);
  await planRun(page);
  await page.reload();
  await expect(panel).toContainText("Four runs this week");
  await expect(page.getByTestId("loop-play")).toHaveAttribute("data-done", "false");

  // Visiting the thread normally still offers a blank checkpoint form.
  await page.getByRole("link", { name: /Run a 10K/ }).click();
  await expect(page.getByLabel("Checkpoint title")).toHaveValue("");
  const points = Number(await page.getByTestId("quest-points").innerText());
  await page.getByRole("link", { name: "← All quests" }).click();

  await panel.getByRole("link", { name: "Log what happened" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Run a 10K", exact: true })).toBeVisible();
  await expect(page.getByLabel("Checkpoint title")).toHaveValue(plan);
  const actual = "Walked to the park and jogged two laps";
  await page.getByLabel("Checkpoint title").fill(actual);
  await page.getByLabel("Time spent").selectOption("30");
  await page.getByRole("button", { name: "Log checkpoint" }).click();
  await expect(page.getByRole("heading", { name: actual, exact: true })).toHaveCount(1);
  await expect(page.getByTestId("quest-points")).toHaveText(String(points + 5));
  await page.getByRole("link", { name: "← All quests" }).click();
  await expect(page.getByTestId("loop-play")).toHaveAttribute("data-done", "true");
  await expect(panel.getByRole("button", { name: "Choose a next step" })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Log what happened" })).toHaveCount(0);
});

test("a step can be kept, changed and released across days without moving the thread", async ({ page }) => {
  const panel = today(page);
  const keep = panel.getByRole("button", { name: "Keep it" });
  await planRun(page);
  await advanceDay(page);
  await keep.click();
  await expect(keep).toHaveCount(0);
  await expect(panel.getByText(plan, { exact: true })).toBeVisible();
  await advanceDay(page);
  await expect(keep).toBeVisible();
  await panel.getByRole("button", { name: "Change it" }).click();
  const step = panel.getByRole("textbox", { name: "Next step", exact: true });
  await expect(step).toHaveValue(plan);
  await step.fill("Walk to the corner");
  await panel.getByRole("button", { name: "Save next step" }).click();
  await expect(panel.getByText("Walk to the corner", { exact: true })).toBeVisible();
  await expect(keep).toHaveCount(0);
  await advanceDay(page);
  await panel.getByRole("button", { name: "Let it go" }).click();
  await expect(panel.getByRole("button", { name: "Choose a next step" })).toBeVisible();
  await page.reload();
  await expect(panel.getByText("Walk to the corner", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("loop-play")).toHaveAttribute("data-done", "false");
  await panel.getByRole("link", { name: "Log a checkpoint" }).click();
  await expect(page.getByLabel("Checkpoint title")).toHaveValue("");
});

test("an old checkpoint form cannot log a step that changed in another tab", async ({ page, context }) => {
  const panel = today(page);
  await planRun(page);
  const oldForm = await context.newPage();
  await oldForm.goto((await panel.getByRole("link", { name: "Log what happened" }).getAttribute("href"))!);
  await expect(oldForm.getByLabel("Checkpoint title")).toHaveValue(plan);

  await panel.getByRole("button", { name: "Change it" }).click();
  const replacement = "Stretch for ten minutes";
  await panel.getByRole("textbox", { name: "Next step", exact: true }).fill(replacement);
  await panel.getByRole("button", { name: "Save next step" }).click();
  await expect(panel.getByText(replacement, { exact: true })).toBeVisible();

  await oldForm.getByRole("button", { name: "Log checkpoint" }).click();
  await expect(oldForm.getByRole("status")).toContainText(/changed/i);
  await oldForm.reload();
  await expect(oldForm.getByRole("link", { name: "Back to Today" })).toBeVisible();
  await expect(oldForm.getByRole("heading", { name: plan, exact: true })).toHaveCount(0);
  await oldForm.getByRole("link", { name: "Back to Today" }).click();
  await expect(today(oldForm).getByText(replacement, { exact: true })).toBeVisible();
  await expect(oldForm.getByTestId("loop-play")).toHaveAttribute("data-done", "false");
});
