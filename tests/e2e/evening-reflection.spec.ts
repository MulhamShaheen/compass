import { expect, test } from "@playwright/test";
import type { Db } from "../../src/lib/db/schema";

test("reflect on a checkpoint and find its context in the logbook and export", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample character" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sample character loaded" })).toBeVisible();
  const day = page.getByLabel("Prototype tools").getByText(/^Day \d+$/);
  const previousDay = await day.innerText();
  await page.getByRole("button", { name: "Next day" }).click();
  await expect(day).not.toHaveText(previousDay);

  const journal = page.getByRole("region", { name: "Logbook" });
  const reflect = journal.getByRole("button", { name: "Reflect on a checkpoint" });
  await expect(reflect).toHaveCount(0);
  await page.getByRole("link", { name: /Run a 10K/ }).click();
  const title = "Walked a lap with my sister";
  await page.getByLabel("Checkpoint title").fill(title);
  await page.getByRole("button", { name: "Log checkpoint" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await page.getByLabel("Checkpoint title").fill("Stretched afterwards");
  await page.getByRole("button", { name: "Log checkpoint" }).click();
  await expect(page.getByRole("heading", { name: "Stretched afterwards" })).toBeVisible();
  const points = await page.getByTestId("quest-points").innerText();
  await page.getByRole("link", { name: "← All quests" }).click();

  const body = "We had time to talk on the way home.";
  const draft = journal.getByRole("textbox", { name: "Logbook entry" });
  await draft.fill(body);
  await reflect.click();
  const picker = journal.getByRole("combobox", { name: "Today’s checkpoint" });
  await expect(journal).toContainText("stay close to the people I love");
  await journal.getByRole("button", { name: "Back to daily question" }).click();
  await expect(draft).toHaveValue(body);
  await reflect.click();
  await picker.selectOption({ label: title + " · Run a 10K" });
  await journal.getByRole("button", { name: "Log entry" }).click();
  await expect(draft).toHaveValue("");
  await page.reload();
  await expect(journal.getByText(body, { exact: true })).toBeVisible();
  await expect(page.getByTestId("loop-log")).toHaveAttribute("data-done", "true");
  const exported = await page.request.get("/api/export");
  expect(exported.ok()).toBe(true);
  const data: Db = await exported.json();
  const entries = data.journal.filter((entry) => entry.body === body);
  expect(entries).toHaveLength(1);
  expect(entries[0].prompt).toContain(title);
  expect(entries[0].prompt).toContain("Run a 10K");
  await page.getByRole("link", { name: /Run a 10K/ }).click();
  await expect(page.getByTestId("quest-points")).toHaveText(points);
  const checkpoint = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: title }) });
  await checkpoint.getByRole("button", { name: "Remove" }).click();
  await checkpoint.getByRole("button", { name: "Click again to remove" }).click();
  await expect(checkpoint).toHaveCount(0);
  await page.getByRole("link", { name: "← All quests" }).click();
  await expect(journal.getByText(entries[0].prompt!, { exact: true })).toBeVisible();
});

test("an overnight reflection draft can still be saved under a daily question", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample character" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Sample character loaded" })).toBeVisible();
  const journal = page.getByRole("region", { name: "Logbook" });
  await journal.getByRole("button", { name: "Reflect on a checkpoint" }).click();
  const draft = journal.getByRole("textbox", { name: "Logbook entry" });
  const body = "I want to remember what I learned yesterday.";
  await draft.fill(body);

  const day = page.getByLabel("Prototype tools").getByText(/^Day \d+$/);
  const previousDay = await day.innerText();
  await page.getByRole("button", { name: "Next day" }).click();
  await expect(day).not.toHaveText(previousDay);

  const save = journal.getByRole("button", { name: "Log entry" });
  await expect(save).toBeDisabled();
  await expect(journal.getByRole("combobox", { name: "Today’s checkpoint" }).locator("option:checked")).toContainText("no longer available");
  await expect(draft).toHaveValue(body);
  await journal.getByRole("button", { name: "Back to daily question" }).click();
  await save.click();
  await expect(journal.getByText(body, { exact: true })).toBeVisible();
});
