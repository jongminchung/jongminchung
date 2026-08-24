import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  webServer: {
    command: "pnpm exec vite preview --host 127.0.0.1 --port 1420",
    reuseExistingServer: false,
    url: "http://127.0.0.1:1420",
  },
});
