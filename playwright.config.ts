import { defineConfig, devices } from "@playwright/test";
import { config as loadEnvironment } from "dotenv";

import {
  browserOnlyAuthSecret,
  requireIsolatedBrowserDatabaseUrl,
} from "./tests/e2e/v2-5-test-environment";

const baseURL = "http://127.0.0.1:3000";
const useProductionServer =
  process.env.PLAYWRIGHT_USE_PRODUCTION_SERVER === "true";

loadEnvironment({ path: ".env.local", quiet: true });
const isolatedDatabaseUrl = requireIsolatedBrowserDatabaseUrl();
const browserServerEnvironment = {
  ...process.env,
  AUTH_SECRET: browserOnlyAuthSecret,
  AUTH_TRUST_HOST: "true",
  AUTH_URL: baseURL,
  DATABASE_URL: isolatedDatabaseUrl,
  DIRECT_URL: isolatedDatabaseUrl,
  DOCUMENT_STORAGE_DRIVER: "memory",
  V2_9_TEST_STORAGE_ALLOWED: "true",
};

Object.assign(process.env, browserServerEnvironment);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: useProductionServer ? "npm run start" : "npm run dev -- --webpack",
    env: browserServerEnvironment,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
