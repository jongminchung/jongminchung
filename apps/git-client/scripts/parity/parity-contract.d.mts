import type { ScenarioResult } from "./parity-result.mjs";

export interface ParityContractIndex {
  readonly schemaVersion: 1;
  readonly referenceVersion: string;
  readonly scenarios: readonly {
    readonly id: string;
    readonly testId: string;
    readonly obligationIds: readonly string[];
    readonly requiredDimensions: readonly (
      | "structure"
      | "visual"
      | "accessibility"
      | "interaction"
      | "effects"
      | "performance"
    )[];
    readonly reference: {
      readonly authority: "golden" | "source" | "legacy-manual";
      readonly evidenceIds: readonly string[];
      readonly evidenceVerified: boolean;
      readonly expected: Readonly<Record<string, unknown>>;
    };
  }[];
}

export function parseParityContractIndex(value: unknown): ParityContractIndex;
export function parseCandidateObservation(value: unknown): {
  readonly scenarioId: string;
  readonly buildHash: string;
  readonly observed: Readonly<Record<string, unknown>>;
};
export function buildObligationInventory(
  actionRegistry: unknown,
  contracts: ParityContractIndex,
  scenarioResults: readonly ScenarioResult[],
): {
  readonly results: readonly {
    readonly obligationId: string;
    readonly status: "equal" | "divergent" | "unverified" | "invalid";
    readonly scenarioIds: readonly string[];
    readonly reason?: string;
  }[];
  readonly summary: Readonly<Record<string, unknown>>;
};
