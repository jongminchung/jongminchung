export interface ActionBinding {
  readonly checkedWhen: string | null;
  readonly commandId: string;
  readonly effectKind: "none" | "workspace" | "git-read" | "git-write" | "network" | "settings";
  readonly enabledWhen: string;
  readonly featureGroup: string;
  readonly nativeBoundary: string;
  readonly sourceId: string;
  readonly testSurface: string;
  readonly uiSurface: string;
  readonly visibleWhen: string;
  readonly command?: Readonly<Record<string, unknown>>;
}

export interface ActionRegistryEntry {
  readonly candidateBindings: readonly ActionBinding[];
  readonly classification: string;
  readonly declarationCount: number;
  readonly kind: string;
  readonly sourceFiles: readonly string[];
  readonly sourceId: string;
  readonly sourceMetadata: Readonly<Record<string, unknown>> | null;
  readonly sourceOccurrenceCount: number;
  readonly status: string;
}

export interface ActionRegistry {
  readonly schemaVersion: 1;
  readonly summary: {
    readonly boundCandidateCommands: number;
    readonly sourceObligations: number;
    readonly sourceObligationsWithCandidateBindings: number;
    readonly unresolvedSourceObligations: number;
  };
  readonly entries: readonly ActionRegistryEntry[];
}

export interface ActionRegistryInputs {
  readonly baseline: Readonly<Record<string, unknown>>;
  readonly bindings: readonly ActionBinding[];
  readonly commandManifest: Readonly<Record<string, unknown>>;
  readonly source: Readonly<Record<string, unknown>>;
  readonly sourceToRuntime: Readonly<Record<string, unknown>>;
}

export const DEFAULT_APP_ROOT: string;
export function parseActionBindings(value: unknown): readonly ActionBinding[];
export function loadActionRegistryInputs(
  appRoot?: string,
  parityRoot?: string,
): ActionRegistryInputs;
export function buildActionRegistry(inputs: ActionRegistryInputs): ActionRegistry;
export function writeActionRegistry(registry: ActionRegistry, parityRoot?: string): void;
