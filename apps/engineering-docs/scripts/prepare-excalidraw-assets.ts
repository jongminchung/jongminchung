import { cp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const targetRoot = resolve(appRoot, "public/excalidraw-assets");
const targetFontRoot = resolve(targetRoot, "fonts");
const require = createRequire(import.meta.url);

export async function prepareExcalidrawAssets(): Promise<void> {
  const packageEntry = require.resolve("@excalidraw/excalidraw");
  const fontRoot = resolve(dirname(packageEntry), "fonts");
  await rm(targetRoot, { force: true, recursive: true });
  await mkdir(targetRoot, { recursive: true });
  await cp(fontRoot, targetFontRoot, { force: true, recursive: true });
}

function isMainModule(): boolean {
  const entryPath = process.argv[1];
  return entryPath !== undefined && resolve(entryPath) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  await prepareExcalidrawAssets();
  process.stdout.write("Prepared Excalidraw font assets.\n");
}
