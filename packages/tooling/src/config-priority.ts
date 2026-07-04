import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, parse, resolve } from "node:path";

const require = createRequire(import.meta.url);

interface ConfigPriorityOptions {
  readonly args: readonly string[];
  readonly configNames: readonly string[];
  readonly cwd?: string;
}

interface ResolveConfigArgsOptions extends ConfigPriorityOptions {
  readonly configFlag?: string;
  readonly defaultArgs?: readonly string[];
  readonly defaultConfig: string;
}

interface PackageJsonWithBin {
  readonly bin?: string | Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((entry): entry is string => typeof entry === "string")
  );
}

function readPackageJsonWithBin(filePath: string): PackageJsonWithBin {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (!isRecord(parsed)) return {};

  const { bin } = parsed;
  if (typeof bin === "string" || isStringRecord(bin)) return { bin };
  return {};
}

export function hasExplicitConfigArg(args: readonly string[]): boolean {
  return args.some((arg, index) => {
    if (arg === "-c" || arg === "--config") return args[index + 1] !== undefined;
    return arg.startsWith("-c=") || arg.startsWith("--config=");
  });
}

export function findNearestConfig(
  startDirectory: string,
  configNames: readonly string[],
): string | null {
  let current = resolve(startDirectory);

  while (true) {
    for (const configName of configNames) {
      const candidate = resolve(current, configName);
      if (existsSync(candidate)) return candidate;
    }

    const parent = dirname(current);
    if (parent === current || parse(current).root === current) return null;
    current = parent;
  }
}

export function shouldUseDefaultConfig({
  args,
  configNames,
  cwd = process.cwd(),
}: ConfigPriorityOptions): boolean {
  return !hasExplicitConfigArg(args) && findNearestConfig(cwd, configNames) === null;
}

export function resolveConfigArgs({
  args,
  configNames,
  defaultConfig,
  defaultArgs = [],
  cwd = process.cwd(),
  configFlag = "--config",
}: ResolveConfigArgsOptions): string[] {
  if (hasExplicitConfigArg(args)) return [...args];
  const localConfig = findNearestConfig(cwd, configNames);
  if (localConfig !== null) return [configFlag, localConfig, ...args];
  return [configFlag, defaultConfig, ...args, ...defaultArgs];
}

export function resolvePackageBin(packageName: string, binName: string): string {
  const packageJsonPath = require.resolve(`${packageName}/package.json`);
  const packageJson = readPackageJsonWithBin(packageJsonPath);
  const binPath =
    typeof packageJson.bin === "string" ? packageJson.bin : packageJson.bin?.[binName];
  if (typeof binPath !== "string") {
    throw new Error(`Package ${packageName} does not expose bin ${binName}`);
  }
  return resolve(dirname(packageJsonPath), binPath);
}
