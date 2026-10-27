import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      reportsDirectory: "../../coverage/ui",
      exclude: [
        "dist/**",
        "**/*.test.*",
        "**/*.d.ts",
        "**/fixtures/**",
        "**/__fixtures__/**",
      ],
      thresholds: { perFile: true, lines: 6, functions: 0 },
    },
  },
});
