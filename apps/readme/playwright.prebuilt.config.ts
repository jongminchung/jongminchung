import { defineConfig } from "@playwright/test";
import coreConfig from "./playwright.core.config";

export default defineConfig({
    ...coreConfig,
    webServer: {
        command: "pnpm run start --port 3200",
        port: 3200,
        reuseExistingServer: false,
        timeout: 30_000,
    },
});
