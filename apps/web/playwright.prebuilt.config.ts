import { defineConfig } from "@playwright/test";
import coreConfig from "./playwright.core.config";

export default defineConfig({
    ...coreConfig,
    webServer: {
        command: "PORT=3100 pnpm run start",
        port: 3100,
        reuseExistingServer: false,
        timeout: 30_000,
    },
});
