export interface ParityCompletionResult {
  readonly complete: boolean;
  readonly failures: readonly string[];
}

export const DEFAULT_PARITY_ROOT: string;
export function evaluateParityCompletion(
  inputs: Readonly<Record<string, unknown>>,
): ParityCompletionResult;
export function loadParityCompletionInputs(parityRoot?: string): Readonly<Record<string, unknown>>;
export function assertParityComplete(
  inputs: Readonly<Record<string, unknown>>,
): ParityCompletionResult;
