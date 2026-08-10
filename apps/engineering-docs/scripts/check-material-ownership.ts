import { execFile } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  appOwnedMaterialFiles,
  appOwnedMaterialFileSet,
  upstreamMaterialNotice,
} from "./material-ownership.ts";

const execFileAsync = promisify(execFile);
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = resolve(appRoot, "../..");
const topicsRoot = resolve(appRoot, "components/materials/topics");

function toPosixPath(value: string): string {
  return value.split(sep).join("/");
}

async function sourceFiles(directory: string): Promise<readonly string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry): Promise<readonly string[]> => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return sourceFiles(path);
      return /\.(?:ts|tsx)$/u.test(entry.name) ? [path] : [];
    }),
  );
  return files.flat().sort();
}

const violations: string[] = [];
const files = await sourceFiles(topicsRoot);
for (const path of files) {
  const relativePath = toPosixPath(relative(topicsRoot, path));
  const source = await readFile(path, "utf8");
  const appOwned = appOwnedMaterialFileSet.has(relativePath);
  if (appOwned && source.startsWith(upstreamMaterialNotice)) {
    violations.push(`${relativePath}: application-owned override must be type-checked`);
  }
  if (!appOwned && !source.startsWith(upstreamMaterialNotice)) {
    violations.push(`${relativePath}: vendored source is missing the upstream ownership marker`);
  }
}

for (const relativePath of appOwnedMaterialFiles) {
  if (!files.includes(resolve(topicsRoot, relativePath))) {
    violations.push(`${relativePath}: application-owned override is missing`);
  }
}

if (violations.length > 0) throw new Error(violations.join("\n"));

await execFileAsync(
  "pnpm",
  [
    "exec",
    "oxlint",
    "--config=apps/engineering-docs/.oxlintrc.materials.json",
    ...appOwnedMaterialFiles.map((path) => resolve(topicsRoot, path)),
  ],
  { cwd: workspaceRoot, maxBuffer: 4 * 1024 * 1024 },
);

console.log(
  `Validated ${files.length - appOwnedMaterialFiles.length} vendored material files and ${appOwnedMaterialFiles.length} application-owned overrides.`,
);
