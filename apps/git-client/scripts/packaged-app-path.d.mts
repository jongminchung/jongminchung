export const PACKAGED_APP_PATH_ENV: "GIT_CLIENT_ELECTRON_APP_PATH";

export interface PackagedAppPathOptions {
    readonly cwd?: string;
    readonly environment?: NodeJS.ProcessEnv;
    readonly platform?: NodeJS.Platform;
    readonly architecture?: string;
}

export function resolvePackagedAppPath(
    options?: PackagedAppPathOptions,
): string;
export function resolvePackagedExecutablePath(
    options?: PackagedAppPathOptions,
): string;
