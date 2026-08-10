import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig({
  ...baseConfig,
  testIgnore: ["materials-all.spec.ts", "visual.spec.ts"],
});
