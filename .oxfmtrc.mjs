import { defineOxfmtConfig } from "@jongminchung/tooling/oxfmt";

export default defineOxfmtConfig({
  ignorePatterns: [
    "**/.output/",
    "**/.wxt/",
    "apps/engineering-docs/generated/",
    "apps/engineering-docs/public/search/",
    "playwright-report/",
    "test-results/",
    "rebased/",
  ],
});
