import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./tests",
    outputDir: "./test-results",
    fullyParallel: true,
    retries: process.env.CI ? 2 : 0,
    reporter: "list",
    use: { trace: "retain-on-failure" },
    webServer: {
        command: "pnpm run build && pnpm run start --port 3100",
        port: 3100,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
    },
    projects: [
        {
            name: "home-chromium",
            testMatch: /home.*\.spec\.ts/u,
            use: {
                ...devices["Desktop Chrome"],
                baseURL: "http://jamie.localhost:3100",
                viewport: { width: 1440, height: 1000 },
            },
        },
        {
            name: "tech-chromium",
            testIgnore: [/home.*\.spec\.ts/u, /investment.*\.spec\.ts/u],
            use: {
                ...devices["Desktop Chrome"],
                baseURL: "http://tech.jamie.localhost:3100",
                viewport: { width: 1440, height: 1000 },
            },
        },
        {
            name: "invest-chromium",
            testMatch: /investment.*\.spec\.ts/u,
            use: {
                ...devices["Desktop Chrome"],
                baseURL: "http://invest.jamie.localhost:3100",
                viewport: { width: 1440, height: 1000 },
            },
        },
    ],
});
