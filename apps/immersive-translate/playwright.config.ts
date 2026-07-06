import { defineConfig } from "@playwright/test";

function envFlag(name: string): boolean {
  return process.env[name] === "1" || process.env[name]?.toLowerCase() === "true";
}

export default defineConfig({
  testDir: "./tests/live",
  fullyParallel: false,
  workers: 1,
  reporter: [["dot"], ["./tests/live/qa-reporter.ts"]],
  timeout: 120_000,
  expect: {
    timeout: 15_000,
  },
  outputDir: "test-results/playwright",
  use: {
    ignoreHTTPSErrors: envFlag("PW_IGNORE_HTTPS_ERRORS"),
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
