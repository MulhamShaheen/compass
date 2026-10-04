import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * WCAG 2 A/AA checks with axe-core on every main screen, in both themes.
 * Motion is reduced so the scan sees the settled page (no boot screen or decode text).
 */

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = results.violations.flatMap((v) =>
    v.nodes.map(
      (n) =>
        `${label}: ${v.id} (${v.impact}) ${n.target.join(" ")} :: ${n.failureSummary?.split("\n").slice(1).join(" ").slice(0, 160)}`,
    ),
  );
  expect(summary, summary.join("\n")).toEqual([]);
}

for (const theme of ["dark", "light"] as const) {
  test(`no accessibility violations in the ${theme} theme`, async ({
    page,
  }) => {
    page.on("dialog", (d) => d.accept());
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      (t) => localStorage.setItem("compass-theme", t),
      theme,
    );

    await page.goto("/");
    if (page.url().endsWith("/prologue")) {
      await scan(page, "prologue");
      await page.getByRole("button", { name: "Load sample character" }).click();
      await page.waitForURL((u) => u.pathname === "/");
    } else {
      await page.getByRole("button", { name: "Load sample character" }).click();
    }
    await expect(
      page.getByRole("heading", { name: "Character" }),
    ).toBeVisible();
    await scan(page, "map");

    await page.getByRole("link", { name: /Run a 10K/ }).click();
    await page.waitForURL("**/quests/**");
    await scan(page, "quest thread");

    for (const path of ["/review", "/how", "/settings"]) {
      await page.goto(path);
      await scan(page, path);
    }

    for (const path of ["/offline", "/login"]) {
      await page.goto(path);
      await scan(page, path);
    }

    await page.goto("/");
    await page.getByRole("button", { name: "Start over" }).click();
    await page.waitForURL("**/prologue");
    await scan(page, "prologue");
  });
}
