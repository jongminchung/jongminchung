import { defineConfig } from "@playwright/test";

export default defineConfig({
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixelRatio: 0.01,
    },
  },
  testDir: "tests",
  use: {
    baseURL: "http://127.0.0.1:1420",
    colorScheme: "light",
    trace: "retain-on-failure",
    viewport: { width: 1600, height: 960 },
  },
  webServer: {
    command: "pnpm run dev:web --host 127.0.0.1",
    reuseExistingServer: true,
    url: "http://127.0.0.1:1420",
  },
});
