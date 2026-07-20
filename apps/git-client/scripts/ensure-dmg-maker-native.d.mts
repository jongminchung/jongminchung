export interface DmgMakerNativeResult {
  readonly bindings?: readonly string[];
  readonly rebuilt?: readonly string[];
  readonly skipped: boolean;
}

export function ensureDmgMakerNativeBinding(): Promise<DmgMakerNativeResult>;
