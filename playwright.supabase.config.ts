import { defineConfig, devices } from "@playwright/test";
import { PORT } from "./tests/e2e-supabase/helpers";

/**
 * The same flows against the real Supabase project in .env, signed in as throwaway
 * e2e-*@compass.test users (created in global setup, removed in teardown).
 * Run with: npm run test:e2e:supabase
 */
process.loadEnvFile?.(".env");

export default defineConfig({
  testDir: "tests",
  testMatch: ["e2e/**/*.spec.ts", "e2e-supabase/**/*.spec.ts"],
  timeout: 90_000,
  workers: 1,
  globalSetup: "./tests/e2e-supabase/global-setup.ts",
  globalTeardown: "./tests/e2e-supabase/global-teardown.ts",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", storageState: "test-results/.auth/a.json" },
  projects: [{ name: "phone-supabase", use: { ...devices["iPhone 13"], browserName: "chromium" } }],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { NEXT_DIST_DIR: ".next-e2e-supabase" },
  },
});
