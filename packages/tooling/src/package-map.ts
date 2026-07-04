import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const defaultLocalSourceAliases = Object.freeze([]) satisfies readonly LocalSourceAlias[];

export interface LocalSourceAlias {
  readonly find: RegExp;
  readonly replacementPath: string;
  readonly tsconfigKey: string;
  readonly tsconfigTarget: string;
}

export interface PackageExportAlias {
  readonly packageDirectory: string;
  readonly specifier: string;
  readonly target: string;
}

export interface ViteResolveAlias {
  readonly find: RegExp;
  readonly replacement: string;
}

export interface WorkspacePackage {
  readonly directory: string;
  readonly manifest: Readonly<Record<string, unknown>>;
  readonly name: string;
}

export interface WorkspacePackageMap {
  readonly packages: readonly WorkspacePackage[];
  readonly rootDir: string;
}

export type TsconfigPaths = Record<string, readonly string[]>;

export interface TsconfigAliasConfig {
  readonly $schema: string;
  readonly compilerOptions: {
    readonly paths: TsconfigPaths;
  };
}

interface ExportMapEntry {
  readonly subpath: string;
  readonly target: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function resolveDefaultRootDir(): string {
  return process.cwd();
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function toPosixPath(path: string): string {
  return path.split(sep).join("/");
}

function toTsconfigPath(rootDir: string, filePath: string): string {
  return `./${toPosixPath(relative(rootDir, filePath))}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function expandWorkspacePattern(rootDir: string, pattern: string): string[] {
  if (!pattern.endsWith("/*")) return [resolve(rootDir, pattern)];

  const parent = resolve(rootDir, pattern.slice(0, -2));
  if (!existsSync(parent)) return [];

  return readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(parent, entry.name))
    .sort();
}

function workspacePatterns(rootPackageJson: unknown): readonly string[] {
  if (!isRecord(rootPackageJson)) return [];

  const { workspaces } = rootPackageJson;
  if (
    Array.isArray(workspaces) &&
    workspaces.every((item): item is string => typeof item === "string")
  ) {
    return workspaces;
  }

  if (isRecord(workspaces)) {
    const { packages } = workspaces;
    if (
      Array.isArray(packages) &&
      packages.every((item): item is string => typeof item === "string")
    ) {
      return packages;
    }
  }

  return [];
}

function resolveExportTarget(value: unknown, conditions: readonly string[]): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const target = resolveExportTarget(item, conditions);
      if (target !== null) return target;
    }
    return null;
  }
  if (!isRecord(value)) return null;

  for (const condition of conditions) {
    if (condition in value) {
      const target = resolveExportTarget(value[condition], conditions);
      if (target !== null) return target;
    }
  }

  for (const item of Object.values(value)) {
    const target = resolveExportTarget(item, conditions);
    if (target !== null) return target;
  }
  return null;
}

function exportMapEntries(exportsField: unknown, conditions: readonly string[]): ExportMapEntry[] {
  if (exportsField === undefined) return [];
  if (typeof exportsField === "string" || Array.isArray(exportsField)) {
    const target = resolveExportTarget(exportsField, conditions);
    return target === null ? [] : [{ subpath: ".", target }];
  }
  if (!isRecord(exportsField)) return [];

  const keys = Object.keys(exportsField);
  const isSubpathMap = keys.some((key) => key.startsWith("."));
  if (!isSubpathMap) {
    const target = resolveExportTarget(exportsField, conditions);
    return target === null ? [] : [{ subpath: ".", target }];
  }

  return keys
    .sort()
    .map((subpath) => {
      const target = resolveExportTarget(exportsField[subpath], conditions);
      return target === null ? null : { subpath, target };
    })
    .filter((entry): entry is ExportMapEntry => entry !== null);
}

function specifierForExport(packageName: string, subpath: string): string {
  if (subpath === ".") return packageName;
  return `${packageName}/${subpath.replace(/^\.\//, "")}`;
}

function targetPathForExport(rootDir: string, packageDirectory: string, target: string): string {
  return resolve(rootDir, packageDirectory, target.replace(/^\.\//, ""));
}

export function loadWorkspacePackageMap({
  rootDir = resolveDefaultRootDir(),
}: {
  readonly rootDir?: string;
} = {}): WorkspacePackageMap {
  const resolvedRootDir = resolve(rootDir);
  const rootPackageJson = readJson(join(resolvedRootDir, "package.json"));
  const packageDirectories = workspacePatterns(rootPackageJson).flatMap((pattern) =>
    expandWorkspacePattern(resolvedRootDir, pattern),
  );

  const packages = packageDirectories
    .map((directory) => {
      const packageJsonPath = join(directory, "package.json");
      if (!existsSync(packageJsonPath)) return null;

      const manifest = readJson(packageJsonPath);
      if (!isRecord(manifest) || typeof manifest.name !== "string") return null;

      return Object.freeze({
        directory: toPosixPath(relative(resolvedRootDir, directory)),
        manifest: Object.freeze(manifest),
        name: manifest.name,
      });
    })
    .filter((entry): entry is WorkspacePackage => entry !== null);

  return Object.freeze({
    packages: Object.freeze(packages),
    rootDir: resolvedRootDir,
  });
}

export function createPackageExportAliases({
  conditions = ["source", "default", "import", "types"],
  rootDir = resolveDefaultRootDir(),
}: {
  readonly conditions?: readonly string[];
  readonly rootDir?: string;
} = {}): PackageExportAlias[] {
  const packageMap = loadWorkspacePackageMap({ rootDir });

  return packageMap.packages.flatMap((workspacePackage) =>
    exportMapEntries(workspacePackage.manifest.exports, conditions)
      .filter((entry) => entry.subpath !== "./package.json")
      .map((entry) =>
        Object.freeze({
          packageDirectory: workspacePackage.directory,
          specifier: specifierForExport(workspacePackage.name, entry.subpath),
          target: targetPathForExport(rootDir, workspacePackage.directory, entry.target),
        }),
      ),
  );
}

export function createTsconfigPaths({
  rootDir = resolveDefaultRootDir(),
  localSourceAliases = defaultLocalSourceAliases,
}: {
  readonly localSourceAliases?: readonly LocalSourceAlias[];
  readonly rootDir?: string;
} = {}): TsconfigPaths {
  return Object.fromEntries([
    ...localSourceAliases.map((alias) => [alias.tsconfigKey, [alias.tsconfigTarget]]),
    ...createPackageExportAliases({
      conditions: ["source", "types", "default", "import"],
      rootDir,
    }).map((alias) => [alias.specifier, [toTsconfigPath(rootDir, alias.target)]]),
  ]);
}

export function createTsconfigAliasConfig({
  rootDir = resolveDefaultRootDir(),
  localSourceAliases = defaultLocalSourceAliases,
}: {
  readonly localSourceAliases?: readonly LocalSourceAlias[];
  readonly rootDir?: string;
} = {}): TsconfigAliasConfig {
  return {
    $schema: "https://json.schemastore.org/tsconfig",
    compilerOptions: {
      paths: createTsconfigPaths({ rootDir, localSourceAliases }),
    },
  };
}

export function createViteResolveAliases({
  rootDir = resolveDefaultRootDir(),
  localSourceAliases = defaultLocalSourceAliases,
}: {
  readonly localSourceAliases?: readonly LocalSourceAlias[];
  readonly rootDir?: string;
} = {}): ViteResolveAlias[] {
  const resolvedRootDir = resolve(rootDir);

  return [
    ...localSourceAliases.map((alias) => ({
      find: alias.find,
      replacement: `${resolve(resolvedRootDir, alias.replacementPath)}/`,
    })),
    ...createPackageExportAliases({ rootDir: resolvedRootDir }).map((alias) => ({
      find: new RegExp(`^${escapeRegExp(alias.specifier)}$`),
      replacement: alias.target,
    })),
  ];
}

export function formatTsconfigAliasConfig({
  rootDir = resolveDefaultRootDir(),
  localSourceAliases = defaultLocalSourceAliases,
}: {
  readonly localSourceAliases?: readonly LocalSourceAlias[];
  readonly rootDir?: string;
} = {}): string {
  return `${JSON.stringify(createTsconfigAliasConfig({ rootDir, localSourceAliases }), null, 2)}\n`;
}

export function writeTsconfigAliasConfig({
  filePath,
  localSourceAliases = defaultLocalSourceAliases,
  rootDir = resolveDefaultRootDir(),
}: {
  readonly filePath?: string;
  readonly localSourceAliases?: readonly LocalSourceAlias[];
  readonly rootDir?: string;
} = {}): void {
  writeFileSync(
    filePath ?? join(rootDir, "tsconfig.package-aliases.json"),
    formatTsconfigAliasConfig({ rootDir, localSourceAliases }),
    "utf8",
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--write")) {
    writeTsconfigAliasConfig();
  } else {
    process.stdout.write(formatTsconfigAliasConfig());
  }
}
