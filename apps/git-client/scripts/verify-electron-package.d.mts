export interface ElectronPackageVerification {
  readonly appPath: string;
  readonly bundleId: string;
  readonly electronVersion: string;
  readonly architectures: string;
  readonly localeCount: number;
  readonly locales: readonly string[];
  readonly sizeKiB: number;
  readonly sizeMiB: number;
  readonly asarHash: string;
  readonly codesign: string;
  readonly terminalRuntime: Readonly<{
    readonly architecture: string;
    readonly spawnHelperExecutable: boolean;
  }>;
  readonly fuses: Readonly<Record<string, boolean>>;
}

export function verifyElectronPackage(appPath: string): Promise<ElectronPackageVerification>;
