// oxlint-disable typescript/no-explicit-any -- Native TypeScript entry points retain dynamic process, fixture, and injected test-double boundaries.
import { isAbsolute, join, resolve } from "node:path";

export const PACKAGED_APP_PATH_ENV = "GIT_CLIENT_ELECTRON_APP_PATH";

export interface PackagedAppPathOptions {
  readonly cwd?: string;
  readonly environment?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
  readonly architecture?: string;
}

function absolutePath(value: any, cwd: any) {
  return isAbsolute(value) ? resolve(value) : resolve(cwd, value);
}

export function resolvePackagedAppPath({
  cwd = process.cwd(),
  environment = process.env,
  platform = process.platform,
  architecture = process.arch,
}: PackagedAppPathOptions = {}): string {
  const override = environment[PACKAGED_APP_PATH_ENV];
  if (typeof override === "string" && override.trim().length > 0) {
    return absolutePath(override.trim(), cwd);
  }
  const packageRoot = resolve(
    cwd,
    "out",
    `Git Client-${platform}-${architecture}`,
  );
  return platform === "darwin"
    ? join(packageRoot, "Git Client.app")
    : packageRoot;
}

export function resolvePackagedExecutablePath(
  options: PackagedAppPathOptions = {},
): string {
  const platform = options.platform ?? process.platform;
  const appPath = resolvePackagedAppPath(options);
  if (platform === "darwin") {
    return join(appPath, "Contents", "MacOS", "Git Client");
  }
  if (platform === "win32") return join(appPath, "Git Client.exe");
  return join(appPath, "git-client");
}
