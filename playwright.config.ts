import { defineConfig, devices } from "@playwright/test";

const PORT = 3123;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  workers: 1,
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "phone", use: { ...devices["iPhone 13"], browserName: "chromium" } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/how`,
    reuseExistingServer: false,
    timeout: 180_000,
    // Local file store with no sign-in, and a separate data file, so tests never touch real accounts.
    env: { COMPASS_STORE: "local", COMPASS_DATA_FILE: ".data/e2e.json" },
  },
});
