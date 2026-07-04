import { copyFile } from "node:fs/promises";
import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  dts: true,
  entry: "src/index.ts",
  fixedExtension: false,
  format: "esm",
  hooks: {
    "build:done": async (): Promise<void> => {
      await copyFile("src/styles.css", "dist/styles.css");
      await copyFile("src/baseline.css", "dist/baseline.css");
    },
  },
  outDir: "dist",
  platform: "browser",
  unbundle: true,
});
