export interface HfsNormalizationReport {
  readonly catalogBytes: number;
  readonly normalizedRecords: number;
  readonly timestamp: number;
  readonly uuid: string;
}

export interface ReproducibleDmgReport {
  readonly bytes: number;
  readonly normalization: HfsNormalizationReport;
  readonly target: string;
  readonly udif: { readonly uuid: string };
}

export function normalizeHfsImageBuffer(image: Buffer): HfsNormalizationReport;
export function normalizeHfsImage(filePath: string): Promise<HfsNormalizationReport>;
export function normalizeUdifTrailerBuffer(
  trailer: Buffer,
): { readonly uuid: string };
export function normalizeUdifImage(
  filePath: string,
): Promise<{ readonly uuid: string }>;
export function createReproducibleDmg(
  appPath: string,
  targetPath: string,
  options?: {
    readonly runCommand?: (
      command: string,
      arguments_: readonly string[],
      options?: Readonly<Record<string, unknown>>,
    ) => Promise<unknown>;
    readonly temporaryDirectory?: string;
  },
): Promise<ReproducibleDmgReport>;
