import { defineConfig } from "@playwright/test";

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  outputDir: "test-results/electron-artifacts",
  retries: 0,
  reporter:
    process.env.GIT_CLIENT_VERBOSE_TESTS === "1"
      ? [["line"]]
      : [
          [
            "./scripts/qa/compact-playwright-reporter.mjs",
            {
              suite: "electron",
              outputFile: "test-results/qa/electron.json",
            },
          ],
        ],
  testDir: "electron-tests",
  timeout: 30_000,
  // All package scenarios launch the same bundle identifier. Electron's
  // single-instance lock is application-wide even when the QA userData
  // profiles differ, so parallel workers would connect tests to the wrong
  // process and invalidate repository-side-effect evidence.
  workers: 1,
});
