import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: ".",
    testMatch: "**/*.e2e.test.ts",
    outputDir: "./test-results",
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI
        ? [["github"], ["html", { open: "never" }]]
        : "list",
    expect: {
        toHaveScreenshot: {
            animations: "disabled",
            caret: "hide",
            scale: "css",
        },
    },
    use: {
        trace: "on-first-retry",
        screenshot: "only-on-failure",
        video: "retain-on-failure",
    },
    webServer: {
        command: "pnpm run build && PORT=3100 pnpm run start",
        port: 3100,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
    projects: [
        {
            name: "home-chromium",
            testMatch: /home(?:-visual)?\.e2e\.test\.ts/u,
            use: {
                ...devices["Desktop Chrome"],
                baseURL: "http://jamie.localhost:3100",
                viewport: { width: 1440, height: 1000 },
            },
        },
        {
            name: "tech-chromium",
            testIgnore: [
                /home(?:-visual)?\.e2e\.test\.ts/u,
                /investment(?:-visual)?\.e2e\.test\.ts/u,
            ],
            use: {
                ...devices["Desktop Chrome"],
                baseURL: "http://tech.jamie.localhost:3100",
                viewport: { width: 1440, height: 1000 },
            },
        },
        {
            name: "invest-chromium",
            testMatch: /investment(?:-visual)?\.e2e\.test\.ts/u,
            use: {
                ...devices["Desktop Chrome"],
                baseURL: "http://invest.jamie.localhost:3100",
                viewport: { width: 1440, height: 1000 },
            },
        },
    ],
});
