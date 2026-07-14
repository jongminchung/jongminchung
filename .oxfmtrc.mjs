import { defineOxfmtConfig } from "@jongminchung/tooling/oxfmt";

export default defineOxfmtConfig({
  ignorePatterns: [
    "**/.output/",
    "**/.wxt/",
    "apps/docs/generated/",
    "apps/docs/public/search/",
    "playwright-report/",
    "test-results/",
  ],
});
