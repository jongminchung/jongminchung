export function computeCandidateBuildHash(appRoot: string): Promise<string>;
export function buildCurrentCompletionInput(options?: {
  readonly appRoot?: string;
}): Promise<Readonly<Record<string, unknown>>>;
export function writeParityArtifacts(
  input: Readonly<Record<string, unknown>>,
  result: Readonly<Record<string, unknown>>,
): Promise<string>;
