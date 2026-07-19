import { readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseExcalidrawFilename, type ExcalidrawAsset } from "./excalidraw-scene.ts";

export interface StandaloneExcalidrawAsset extends ExcalidrawAsset {
  readonly filePath: string;
}

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const standaloneExcalidrawRoot = resolve(appRoot, "public/diagrams");

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export async function listStandaloneExcalidrawAssets(): Promise<
  readonly StandaloneExcalidrawAsset[]
> {
  let filenames: readonly string[];
  try {
    filenames = await readdir(standaloneExcalidrawRoot);
  } catch (error: unknown) {
    if (hasErrorCode(error, "ENOENT")) return [];
    throw error;
  }

  return Object.freeze(
    filenames
      .filter((filename) => filename.endsWith(".excalidraw"))
      .map((filename) => {
        const asset = parseExcalidrawFilename(filename);
        return Object.freeze({
          ...asset,
          filePath: resolve(standaloneExcalidrawRoot, filename),
        });
      })
      .sort((left, right) => left.filename.localeCompare(right.filename)),
  );
}

export async function findStandaloneExcalidrawAsset(
  slug: string,
): Promise<StandaloneExcalidrawAsset | null> {
  const assets = await listStandaloneExcalidrawAssets();
  return assets.find((asset) => asset.slug === slug) ?? null;
}
