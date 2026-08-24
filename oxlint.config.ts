import { defineOxlintConfig } from "./packages/tooling/src/oxlint/index.ts";

export default defineOxlintConfig({
  ignorePatterns: [
    "**/node_modules",
    "**/.next",
    "**/dist",
    "**/coverage",
    // content/*.mdx와 material source에서 재생성되므로 생성기와 typecheck로 검증함
    "apps/web/generated/**",
    "apps/web/public/search/**",
  ],
  overrides: [
    {
      files: ["apps/web/**/*.{ts,tsx}"],
      plugins: ["typescript", "unicorn", "oxc", "react", "jsx-a11y", "nextjs"],
      rules: {
        "react/react-compiler": "error",
        "react/rules-of-hooks": "error",
      },
    },
  ],
});
