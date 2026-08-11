import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dependencyGroups = ["dependencies", "devDependencies"] as const;
const rootDir = fileURLToPath(new URL("../../..", import.meta.url));
const workspaceDirectories = ["apps", "packages"] as const;

type DependencyGroup = (typeof dependencyGroups)[number];

interface PackageManifest {
  readonly dependencyRanges: Readonly<Record<DependencyGroup, Readonly<Record<string, string>>>>;
  readonly filePath: string;
  readonly manifest: Readonly<Record<string, unknown>>;
  readonly name: string;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDependencyRanges(
  value: unknown,
  filePath: string,
  group: DependencyGroup,
): Readonly<Record<string, string>> {
  if (value === undefined) return Object.freeze({});
  if (!isRecord(value))
    throw new Error(`${relative(rootDir, filePath)} ${group} must be an object`);

  const ranges: Record<string, string> = {};
  for (const [name, range] of Object.entries(value)) {
    if (typeof range !== "string") {
      throw new Error(`${relative(rootDir, filePath)} ${group}.${name} must be a string`);
    }
    ranges[name] = range;
  }

  return Object.freeze(ranges);
}

async function readPackageManifest(filePath: string): Promise<PackageManifest> {
  const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
  if (!isRecord(parsed) || typeof parsed.name !== "string") {
    throw new Error(`${relative(rootDir, filePath)} must declare a package name`);
  }

  return Object.freeze({
    dependencyRanges: Object.freeze({
      dependencies: parseDependencyRanges(parsed.dependencies, filePath, "dependencies"),
      devDependencies: parseDependencyRanges(parsed.devDependencies, filePath, "devDependencies"),
    }),
    filePath,
    manifest: parsed,
    name: parsed.name,
  });
}

async function listSourceModulePaths(directory: string): Promise<readonly string[]> {
  if (!existsSync(directory)) return [];

  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry): Promise<readonly string[]> => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return listSourceModulePaths(path);
      return /\.(?:ts|tsx)$/u.test(entry.name) ? [path] : [];
    }),
  );
  return paths.flat();
}

function stringTargets(value: unknown): readonly string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringTargets);
  if (!isRecord(value)) return [];
  return Object.values(value).flatMap(stringTargets);
}

function conditionTargets(value: unknown, condition: string): readonly string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => conditionTargets(item, condition));
  }
  if (!isRecord(value)) return [];

  return Object.entries(value).flatMap(([key, nested]) =>
    key === condition ? stringTargets(nested) : conditionTargets(nested, condition),
  );
}

async function listWorkspacePackageJsonPaths(directory: string): Promise<readonly string[]> {
  const entries = await readdir(join(rootDir, directory), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(rootDir, directory, entry.name, "package.json"))
    .filter((filePath) => existsSync(filePath));
}

async function loadWorkspaceManifests(): Promise<readonly PackageManifest[]> {
  const nestedPackageJsonPaths = (
    await Promise.all(
      workspaceDirectories.map((directory) => listWorkspacePackageJsonPaths(directory)),
    )
  ).flat();
  const packageJsonPaths = [join(rootDir, "package.json"), ...nestedPackageJsonPaths];
  return Promise.all(packageJsonPaths.map((filePath) => readPackageManifest(filePath)));
}

describe("workspace catalog contract", () => {
  it("uses catalog references for external dependencies and workspace references internally", async () => {
    const manifests = await loadWorkspaceManifests();
    const workspacePackageNames = new Set(manifests.map((manifest) => manifest.name));

    for (const manifest of manifests) {
      for (const group of dependencyGroups) {
        for (const [dependencyName, range] of Object.entries(manifest.dependencyRanges[group])) {
          const expectedRange = workspacePackageNames.has(dependencyName)
            ? "workspace:*"
            : "catalog:";
          const dependencyPath = `${relative(rootDir, manifest.filePath)} ${group}.${dependencyName}`;
          expect(range, dependencyPath).toBe(expectedRange);
        }
      }
    }
  });

  it("keeps package source APIs on named exports", async () => {
    const manifests = await loadWorkspaceManifests();
    const packageManifests = manifests.filter((manifest) =>
      relative(rootDir, manifest.filePath).startsWith("packages/"),
    );

    for (const manifest of packageManifests) {
      expect(manifest.manifest.type, manifest.name).toBe("module");

      const sourceFiles = await listSourceModulePaths(join(dirname(manifest.filePath), "src"));
      for (const file of sourceFiles) {
        expect(await readFile(file, "utf8"), relative(rootDir, file)).not.toMatch(
          /\bexport\s+default\b/u,
        );
      }
    }
  });

  it("publishes Node 24 ESM-only packages", async () => {
    const manifests = await loadWorkspaceManifests();
    const publishedPackages = manifests.filter(
      (manifest) =>
        relative(rootDir, manifest.filePath).startsWith("packages/") &&
        manifest.manifest.private !== true,
    );

    for (const manifest of publishedPackages) {
      const engines = manifest.manifest.engines;
      expect(isRecord(engines) ? engines.node : undefined, manifest.name).toBe(">=24.0.0");
      expect(manifest.manifest.type, manifest.name).toBe("module");

      const exportsField = manifest.manifest.exports;
      expect(conditionTargets(exportsField, "require"), `${manifest.name} require exports`).toEqual(
        [],
      );
      expect(
        conditionTargets(exportsField, "default").filter((target) => target.endsWith(".js")),
        `${manifest.name} JavaScript default exports`,
      ).toEqual([]);
      expect(
        conditionTargets(exportsField, "import").filter((target) => target.endsWith(".js")).length,
        `${manifest.name} ESM import exports`,
      ).toBeGreaterThan(0);
    }
  });
});
