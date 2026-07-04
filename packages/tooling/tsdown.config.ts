import { copyFile } from "node:fs/promises";
import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/oxfmt/index.ts", "src/oxlint/index.ts", "src/package-map.ts"],
  fixedExtension: false,
  format: "esm",
  hooks: {
    "build:done": async (): Promise<void> => {
      await copyFile("src/oxlint/base.json", "dist/oxlint/base.json");
    },
  },
  outDir: "dist",
  platform: "node",
  unbundle: true,
});
