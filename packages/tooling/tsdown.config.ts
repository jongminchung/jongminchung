import { chmod, copyFile } from "node:fs/promises";
import { defineConfig } from "tsdown";

const executableEntries = [
  "dist/bin/jongminchung-eslint.js",
  "dist/bin/jongminchung-oxfmt.js",
  "dist/bin/jongminchung-oxlint.js",
];

export default defineConfig({
  clean: true,
  dts: true,
  entry: [
    "src/bin/jongminchung-eslint.ts",
    "src/bin/jongminchung-oxfmt.ts",
    "src/bin/jongminchung-oxlint.ts",
    "src/config-priority.ts",
    "src/eslint/default.ts",
    "src/eslint/index.ts",
    "src/oxfmt/index.ts",
    "src/oxlint/index.ts",
    "src/package-map.ts",
    "src/tool-runner.ts",
  ],
  fixedExtension: false,
  format: "esm",
  hooks: {
    "build:done": async (): Promise<void> => {
      await copyFile("src/oxlint/base.json", "dist/oxlint/base.json");
      await Promise.all(executableEntries.map((filePath) => chmod(filePath, 0o755)));
    },
  },
  outDir: "dist",
  platform: "node",
  unbundle: true,
});
