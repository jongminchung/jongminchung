import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dependencyGroups = ["dependencies", "devDependencies"] as const;
const rootDir = fileURLToPath(new URL("../../..", import.meta.url));
const workspaceDirectories = ["apps", "packages"] as const;

type DependencyGroup = (typeof dependencyGroups)[number];

interface PackageManifest {
  readonly dependencyRanges: Readonly<Record<DependencyGroup, Readonly<Record<string, string>>>>;
  readonly filePath: string;
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
    name: parsed.name,
  });
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
});
