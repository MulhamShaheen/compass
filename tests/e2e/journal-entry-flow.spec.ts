import { expect, test, type Page } from "@playwright/test";

async function advanceDay(page: Page) {
  const day = page.getByLabel("Prototype tools").getByText(/^Day \d+$/);
  const previousDay = await day.innerText();
  await page.getByRole("button", { name: "Next day" }).click();
  await expect(day).not.toHaveText(previousDay);
}

test("write from Today, revisit yesterday’s entry, and choose whether to keep or delete it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample character" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sample character loaded" })).toBeVisible();
  await advanceDay(page);

  const today = page.getByRole("region", { name: "Today", exact: true });
  const journal = page.getByRole("region", { name: "Logbook", exact: true });
  const composer = journal.getByRole("textbox", { name: "Logbook entry", exact: true });
  const loop = today.getByTestId("loop-log");
  const original = "I had time to read on the train.";
  const revised = "I finished a chapter on the train.";

  await today.getByRole("link", { name: "Write one entry" }).click();
  await expect(composer).toBeFocused();
  await composer.fill(original);
  await journal.getByRole("button", { name: "Log entry", exact: true }).click();
  await expect(loop).toHaveAttribute("data-done", "true");
  const saved = journal.getByRole("region", { name: "Saved entries" });
  const originalEntry = saved.getByRole("article").filter({ hasText: original });
  await expect(originalEntry).toContainText("Today");
  await advanceDay(page);
  await expect(originalEntry).toContainText("Yesterday");
  await expect(loop).toHaveAttribute("data-done", "false");

  await originalEntry.getByRole("button", { name: "Edit entry" }).click();
  const editor = saved.getByRole("textbox", { name: "Edit logbook entry" });
  await editor.fill("Discard this change.");
  await saved.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(originalEntry).toBeVisible();

  await originalEntry.getByRole("button", { name: "Edit entry" }).click();
  await editor.fill(revised);
  await saved.getByRole("button", { name: "Save changes" }).click();
  const updated = saved.getByRole("article").filter({ hasText: revised });
  await expect(updated).toContainText("Yesterday");
  await page.reload();
  await expect(updated).toBeVisible();
  await updated.getByRole("button", { name: "Delete entry" }).click();
  await saved.getByRole("button", { name: "Keep entry" }).click();
  await expect(updated).toBeVisible();
  await updated.getByRole("button", { name: "Delete entry" }).click();
  await saved.getByRole("button", { name: "Delete permanently" }).click();
  await expect(updated).toHaveCount(0);
  await page.reload();
  await expect(updated).toHaveCount(0);
  await expect(saved.getByRole("article").first()).toBeVisible();
});
