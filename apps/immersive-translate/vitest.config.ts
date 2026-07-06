import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/.output/**", "**/.wxt/**", "tests/live/**"],
    globals: false,
    testTimeout: 30_000,
  },
});
