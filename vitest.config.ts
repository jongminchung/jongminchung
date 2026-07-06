import { fileURLToPath } from "node:url";
import { createViteResolveAliases } from "@jongminchung/tooling/package-map";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

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
    alias: createViteResolveAliases({ rootDir }),
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
          include: ["apps/**/*.test.ts"],
          name: "apps",
        },
      },
    ],
    testTimeout: 30_000,
  },
});
