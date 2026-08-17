import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig({
    ...baseConfig,
    projects: baseConfig.projects
        ?.filter((project) => project.name === "tech-chromium")
        .map((project) => ({
            ...project,
            testMatch: ["materials-all.spec.ts", "materials.spec.ts"],
        })),
    testMatch: ["materials-all.spec.ts", "materials.spec.ts"],
    webServer: {
        command: "PORT=3100 pnpm run start",
        port: 3100,
        reuseExistingServer: false,
        timeout: 30_000,
    },
});
