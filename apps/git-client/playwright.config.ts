import { defineConfig } from "@playwright/test";

export default defineConfig({
    expect: {
        toHaveScreenshot: {
            animations: "disabled",
            maxDiffPixelRatio: 0.01,
        },
    },
    outputDir: "test-results/renderer-artifacts",
    testDir: "tests",
    reporter:
        process.env.GIT_CLIENT_VERBOSE_TESTS === "1"
            ? [["line"]]
            : [
                  [
                      "./scripts/qa/compact-playwright-reporter.mjs",
                      {
                          suite: "renderer",
                          outputFile: "test-results/qa/renderer.json",
                      },
                  ],
              ],
    use: {
        baseURL: "http://127.0.0.1:1420",
        colorScheme: "light",
        trace: "retain-on-failure",
        viewport: { width: 1600, height: 960 },
    },
    webServer: {
        command: "pnpm exec vite --host 127.0.0.1",
        reuseExistingServer: true,
        url: "http://127.0.0.1:1420",
    },
});
