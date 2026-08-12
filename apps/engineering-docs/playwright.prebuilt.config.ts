import { defineConfig } from "@playwright/test";
import coreConfig from "./playwright.core.config";

export default defineConfig({
    ...coreConfig,
    webServer: {
        command: "pnpm run start --port 3100",
        port: 3100,
        reuseExistingServer: false,
        timeout: 30_000,
    },
});
