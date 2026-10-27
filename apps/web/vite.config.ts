import { resolve } from "node:path";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { defineConfig } from "vite-plus";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  plugins: fumadocsMdx({ index: false }),
  resolve: {
    alias: {
      "server-only": resolve(
        import.meta.dirname,
        "scripts/test-server-only.ts",
      ),
    },
  },
  test: {
    include: ["**/*.test.{ts,tsx}"],
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.output/**",
      "**/.tmp-*/**",
      "**/.wxt/**",
      "tests/**",
      "**/*.e2e.test.*",
    ],
    testTimeout: 60000,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "../../coverage/web",
      exclude: [
        "**/*.test.*",
        "**/*.e2e.test.*",
        "**/*.d.ts",
        "**/fixtures/**",
        "**/__fixtures__/**",
        ".source/**",
        "app/**",
        "components/**",
        "content/**",
        "scripts/**",
        "source.config.ts",
        "mdx-components.tsx",
        "proxy.ts",
        "../../packages/**",
        "lib/content-repository.ts",
        "lib/fumadocs-source.ts",
        "lib/tech/search-server.ts",
        "**/generated/**",
      ],
      thresholds: { perFile: true, lines: 20, functions: 0 },
    },
  },
});
