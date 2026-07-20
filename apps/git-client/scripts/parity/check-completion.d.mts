export interface ParityCompletionResult {
  readonly complete: boolean;
  readonly counts: Readonly<Record<string, number>>;
  readonly bridge: Readonly<Record<string, number>>;
  readonly failures: readonly string[];
}

export function evaluateParityCompletion(
  inputs: Readonly<Record<string, unknown>>,
): ParityCompletionResult;
export function assertParityComplete(
  inputs: Readonly<Record<string, unknown>>,
): ParityCompletionResult;
