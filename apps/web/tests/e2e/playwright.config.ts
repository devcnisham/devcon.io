import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".",
  testMatch: "files.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL:
      process.env.FILES_E2E_URL ||
      "http://127.0.0.1:4197/tests/e2e/harness/index.html",
    headless: true,
    launchOptions: process.env.FILES_E2E_CHROME
      ? { executablePath: process.env.FILES_E2E_CHROME }
      : {},
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: process.env.FILES_E2E_URL
    ? undefined
    : {
        command:
          "node node_modules/vite/bin/vite.js --config tests/e2e/harness/vite.config.mjs",
        url: "http://127.0.0.1:4197/tests/e2e/harness/index.html",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        cwd: process.cwd(),
      },
});
