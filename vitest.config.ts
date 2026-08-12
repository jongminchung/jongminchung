import { defineConfig } from "vitest/config";

const vitestExclude = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.output/**",
  "**/.tmp-*/**",
  "**/.wxt/**",
  "**/tests/live/**",
];

export default defineConfig({
  resolve: {
    conditions: ["source", "module", "browser", "development|production"],
  },
  test: {
    environment: "node",
    exclude: vitestExclude,
    globals: false,
    hookTimeout: 30_000,
    projects: [
      {
        extends: true,
        test: {
          exclude: [...vitestExclude, "**/*.integration.test.ts", "**/*.e2e.test.ts"],
          include: ["packages/**/*.test.ts"],
          name: "unit",
        },
      },
      {
        extends: true,
        test: {
          fileParallelism: false,
          include: ["packages/**/*.integration.test.ts"],
          name: "integration",
        },
      },
      {
        extends: true,
        test: {
          include: ["apps/**/*.test.{mjs,ts}"],
          name: "apps",
        },
      },
    ],
    testTimeout: 30_000,
  },
});
