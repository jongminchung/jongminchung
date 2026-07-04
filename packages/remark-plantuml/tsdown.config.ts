import { copyFile } from "node:fs/promises";
import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts", "src/astro.ts"],
  fixedExtension: false,
  format: "esm",
  hooks: {
    "build:done": async (): Promise<void> => {
      await copyFile("src/styles.css", "dist/styles.css");
      await copyFile("src/starlight.css", "dist/starlight.css");
    },
  },
  outDir: "dist",
  platform: "node",
  unbundle: true,
});
