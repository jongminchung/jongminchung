import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { listStandaloneExcalidrawAssets } from "../lib/excalidraw-files.ts";
import { parseExcalidrawSource } from "../lib/excalidraw-scene.ts";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contentRoot = resolve(appRoot, "content");

export interface ExcalidrawFence {
  readonly index: number;
  readonly source: string;
}

async function listMdxFiles(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry): Promise<readonly string[]> => {
      const entryPath = resolve(directory, entry.name);
      return entry.isDirectory() ? listMdxFiles(entryPath) : [entryPath];
    }),
  );
  return files
    .flat()
    .filter((filePath) => extname(filePath) === ".mdx")
    .sort();
}

export function findExcalidrawFences(markdown: string): readonly ExcalidrawFence[] {
  const fences: ExcalidrawFence[] = [];
  const pattern = /^ {0,3}```excalidraw[\t ]*\r?\n([\s\S]*?)^ {0,3}```[\t ]*$/gimu;
  for (const [index, match] of [...markdown.matchAll(pattern)].entries()) {
    const source = match[1];
    if (source !== undefined) fences.push(Object.freeze({ index, source }));
  }
  return Object.freeze(fences);
}

export async function checkExcalidrawContent(): Promise<{
  readonly inlineCount: number;
  readonly standaloneCount: number;
}> {
  const standaloneAssets = await listStandaloneExcalidrawAssets();
  await Promise.all(
    standaloneAssets.map(async (asset): Promise<void> => {
      const source = await readFile(asset.filePath, "utf8");
      parseExcalidrawSource(source, asset.filePath);
    }),
  );

  const mdxFiles = await listMdxFiles(contentRoot);
  const inlineCounts = await Promise.all(
    mdxFiles.map(async (filePath): Promise<number> => {
      const markdown = await readFile(filePath, "utf8");
      const fences = findExcalidrawFences(markdown);
      for (const fence of fences) {
        parseExcalidrawSource(fence.source, `${filePath}#excalidraw-${fence.index + 1}`);
      }
      return fences.length;
    }),
  );

  return Object.freeze({
    inlineCount: inlineCounts.reduce((sum, count) => sum + count, 0),
    standaloneCount: standaloneAssets.length,
  });
}

function isMainModule(): boolean {
  const entryPath = process.argv[1];
  return entryPath !== undefined && resolve(entryPath) === fileURLToPath(import.meta.url);
}

if (isMainModule()) {
  const result = await checkExcalidrawContent();
  process.stdout.write(
    `Validated ${result.standaloneCount} standalone Excalidraw files and ${result.inlineCount} inline scenes.\n`,
  );
}
