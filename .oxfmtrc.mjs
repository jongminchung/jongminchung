import { defineOxfmtConfig } from "./packages/tooling/src/oxfmt/index.ts";

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
