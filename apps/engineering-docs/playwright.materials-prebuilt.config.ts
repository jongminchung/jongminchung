import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig({
    ...baseConfig,
    testMatch: ["materials-all.spec.ts", "materials.spec.ts"],
    webServer: {
        command: "pnpm run start --port 3100",
        port: 3100,
        reuseExistingServer: false,
        timeout: 30_000,
    },
});
