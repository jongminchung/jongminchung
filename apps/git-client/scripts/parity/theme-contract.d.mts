export interface ThemeParityContract {
  readonly schemaVersion: 1;
  readonly reference: { readonly product: "Rebased"; readonly version: "1.1.8" };
  readonly thresholds: {
    readonly maximumChannelDelta: number;
    readonly maximumGeometryDeltaCssPixels: number;
    readonly maximumMismatchPercent: number;
    readonly minimumStructuralSsim: number;
  };
  readonly themes: Readonly<
    Record<
      "light" | "dark",
      { readonly sourceTheme: string; readonly tokens: Readonly<Record<string, string>> }
    >
  >;
  readonly geometry: Readonly<
    Record<"mainToolbar" | "logTab" | "compactRow" | "statusBar", number>
  >;
  readonly goldens: readonly {
    readonly path: string;
    readonly sha256: string;
    readonly width: number;
    readonly height: number;
    readonly theme: "light" | "dark";
  }[];
}

export function loadThemeParityContract(parityRoot?: string): ThemeParityContract;
export function resolveThemeColors(
  contract: ThemeParityContract,
  parityRoot?: string,
): Readonly<Record<"light" | "dark", Readonly<Record<string, string>>>>;
export function verifyThemeContract(appRoot?: string): Readonly<{
  goldens: number;
  themes: number;
  tokens: number;
}>;
