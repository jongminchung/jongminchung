import { glob, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

interface PackageManifest {
  readonly exports?: Readonly<Record<string, unknown>>;
  readonly name?: string;
}

const packageDirectoryArgument = process.argv[2];
if (packageDirectoryArgument === undefined) {
  throw new Error("Usage: verify-package-build.ts <package-directory>");
}

const packageDirectory = resolve(packageDirectoryArgument);
const manifest = JSON.parse(
  await readFile(resolve(packageDirectory, "package.json"), "utf8"),
) as PackageManifest;
const declaredImportTargets = Object.values(manifest.exports ?? {}).flatMap(
  (target) => {
    if (
      typeof target === "object" &&
      target !== null &&
      "import" in target &&
      typeof target.import === "string"
    ) {
      return [target.import];
    }
    return [];
  },
);
const importTargets: string[] = [];
for (const target of declaredImportTargets) {
  if (!target.includes("*")) {
    importTargets.push(target);
    continue;
  }

  const matches = await Array.fromAsync(
    glob(target, { cwd: packageDirectory }),
  );
  importTargets.push(...matches);
}

if (importTargets.length === 0) {
  throw new Error(`${manifest.name ?? packageDirectory} has no import exports`);
}

await Promise.all(
  importTargets.map(
    (target) => import(pathToFileURL(resolve(packageDirectory, target)).href),
  ),
);

console.log(
  `Verified ${String(importTargets.length)} Node ESM exports from ${manifest.name ?? packageDirectory}`,
);
