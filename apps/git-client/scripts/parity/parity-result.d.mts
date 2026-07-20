export type ParityDimension =
  | "structure"
  | "visual"
  | "accessibility"
  | "interaction"
  | "effects"
  | "performance";

export interface ReferenceScenario {
  readonly id: string;
  readonly obligationIds: readonly string[];
  readonly requiredDimensions: readonly ParityDimension[];
  readonly reference: {
    readonly evidenceVerified: boolean;
    readonly expected: Readonly<Partial<Record<ParityDimension, unknown>>>;
  };
}

export interface CandidateObservation {
  readonly scenarioId: string;
  readonly buildHash: string;
  readonly observed: Readonly<Partial<Record<ParityDimension, unknown>>>;
}

export interface ScenarioResult {
  readonly scenarioId: string;
  readonly comparatorVersion?: number;
  readonly status: "equal" | "divergent" | "unverified" | "invalid";
  readonly obligationIds: readonly string[];
  readonly dimensions?: readonly unknown[];
  readonly firstFailure?: Readonly<Record<string, unknown>>;
}

export const PARITY_COMPARATOR_VERSION: number;

export function compareParityScenario(
  reference: ReferenceScenario,
  candidate: CandidateObservation,
  expectedBuildHash?: string,
): ScenarioResult;

export function summarizeParityResults(
  results: readonly ScenarioResult[],
): Readonly<Record<string, unknown>>;
