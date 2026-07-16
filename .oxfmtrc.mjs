import { defineOxfmtConfig } from "@jongminchung/tooling/oxfmt";

export default defineOxfmtConfig({
  ignorePatterns: [
    "**/.output/",
    "**/.wxt/",
    "apps/docs/generated/",
    "apps/docs/public/search/",
    "apps/git-client/src-tauri/gen/",
    "playwright-report/",
    "test-results/",
  ],
});
