export const ELECTRON_LOCALE_ALLOWLIST: readonly string[];

export interface LocaleVerification {
  readonly resourcesPath: string;
  readonly locales: readonly string[];
}

export interface LocalePruneResult {
  readonly skipped: boolean;
  readonly resourcesPath?: string;
  readonly removed: readonly string[];
  readonly kept: readonly string[];
}

export function electronFrameworkResourcesPath(buildPath: string): string;
export function packagedElectronFrameworkResourcesPath(appPath: string): string;
export function verifyElectronLocales(resourcesPath: string): Promise<LocaleVerification>;
export function pruneElectronLocales(input: {
  readonly buildPath: string;
  readonly platform: string;
}): Promise<LocalePruneResult>;
