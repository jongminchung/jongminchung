import { defineOxfmtConfig } from "@jongminchung/tooling/oxfmt";

export default defineOxfmtConfig({
  ignorePatterns: ["**/.output/", "**/.wxt/", "playwright-report/", "test-results/"],
});
