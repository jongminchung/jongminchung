export interface ReferenceEvidenceFailure {
  readonly id: string;
  readonly path: string;
  readonly reason: "missing" | "hash-mismatch" | "unsafe-path";
  readonly expected?: string;
  readonly actual?: string;
}

export interface ReferenceManifest {
  readonly schemaVersion: 1;
  readonly reference: Readonly<Record<string, unknown>>;
  readonly evidence: readonly Readonly<Record<string, unknown>>[];
}

export function parseReferenceManifest(value: unknown): ReferenceManifest;
export function verifyReferenceEvidence(
  root: string,
  manifest: ReferenceManifest,
): Promise<{ readonly verified: boolean; readonly failures: readonly ReferenceEvidenceFailure[] }>;
export function resolveScenarioReference(
  scenarioReference: Readonly<Record<string, unknown>>,
  manifest: ReferenceManifest,
  integrity: { readonly verified: boolean; readonly failures: readonly ReferenceEvidenceFailure[] },
): Readonly<Record<string, unknown>> & { readonly evidenceVerified: boolean };
