import { spawn, type ChildProcess } from "node:child_process";
import { basename, delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfigArgs, resolvePackageBin } from "./config-priority.js";

export interface ToolArgsOptions {
  readonly args?: readonly string[];
  readonly configFlag?: string;
  readonly configNames: readonly string[];
  readonly cwd?: string;
  readonly defaultArgs?: readonly string[];
  readonly defaultConfig: string | URL;
}

export interface RunConfiguredToolOptions extends ToolArgsOptions {
  readonly binName: string;
  readonly packageName: string;
  readonly pathDependencies?: readonly ToolPathDependency[];
}

export interface ToolPathDependency {
  readonly binName: string;
  readonly packageName: string;
}

function resolveConfigPath(config: string | URL): string {
  if (config instanceof URL) return fileURLToPath(config);
  return config;
}

function findNearestNodeModulesBin(filePath: string): string | null {
  let current = dirname(filePath);

  while (true) {
    if (basename(current) === "node_modules") return join(current, ".bin");

    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function pathDirectoriesForDependencies(
  pathDependencies: readonly ToolPathDependency[],
): readonly string[] {
  return pathDependencies.flatMap((dependency) => {
    const binPath = resolvePackageBin(dependency.packageName, dependency.binName);
    const nodeModulesBin = findNearestNodeModulesBin(binPath);
    return nodeModulesBin === null ? [dirname(binPath)] : [nodeModulesBin, dirname(binPath)];
  });
}

export function resolveConfiguredToolArgs({
  args = process.argv.slice(2),
  configNames,
  defaultArgs = [],
  defaultConfig,
  cwd = process.cwd(),
  configFlag = "--config",
}: ToolArgsOptions): string[] {
  return resolveConfigArgs({
    args,
    configNames,
    cwd,
    configFlag,
    defaultArgs,
    defaultConfig: resolveConfigPath(defaultConfig),
  });
}

export function runConfiguredTool({
  packageName,
  binName,
  args = process.argv.slice(2),
  configNames,
  defaultArgs = [],
  defaultConfig,
  cwd = process.cwd(),
  configFlag = "--config",
  pathDependencies = [],
}: RunConfiguredToolOptions): ChildProcess {
  const finalArgs = resolveConfiguredToolArgs({
    args,
    configNames,
    defaultArgs,
    defaultConfig,
    cwd,
    configFlag,
  });
  const pathDependencyDirectories = pathDirectoriesForDependencies(pathDependencies);
  const path = [pathDependencyDirectories, process.env.PATH ?? ""].flat().join(delimiter);

  const child = spawn(resolvePackageBin(packageName, binName), finalArgs, {
    env: {
      ...process.env,
      PATH: path,
    },
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  child.once("error", (error) => {
    console.error(error);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 1);
  });

  return child;
}
