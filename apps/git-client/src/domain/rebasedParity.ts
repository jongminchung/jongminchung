import rawBindings from "../../parity/rebased/1.1.8/manifest/action-bindings.json";
import rawRegistry from "../../parity/rebased/1.1.8/source/action-registry.json";

export type RebasedFeatureGroup =
  | "shell"
  | "project"
  | "log"
  | "changes"
  | "editor"
  | "refs"
  | "synchronization"
  | "history-rewrite"
  | "conflicts"
  | "github"
  | "gitlab"
  | "hosting"
  | "platform";

export type RebasedSourceId = `${string}:${string}`;

export interface RebasedActionBinding {
  readonly sourceId: RebasedSourceId;
  readonly commandId: string;
  readonly featureGroup: RebasedFeatureGroup;
  readonly uiSurface: string;
  readonly nativeBoundary: string;
  readonly testSurface: string;
  readonly effectKind:
    | "none"
    | "workspace"
    | "git-read"
    | "git-write"
    | "network"
    | "filesystem-read"
    | "filesystem-write"
    | "settings";
  readonly visibleWhen: string;
  readonly enabledWhen: string;
  readonly checkedWhen: string | null;
}

interface RebasedRegistryEntry {
  readonly sourceId: RebasedSourceId;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseFeatureGroup(value: unknown): RebasedFeatureGroup | null {
  if (
    value === "shell" ||
    value === "project" ||
    value === "log" ||
    value === "changes" ||
    value === "editor" ||
    value === "refs" ||
    value === "synchronization" ||
    value === "history-rewrite" ||
    value === "conflicts" ||
    value === "github" ||
    value === "gitlab" ||
    value === "hosting" ||
    value === "platform"
  ) {
    return value;
  }
  return null;
}

function parseSourceId(value: unknown): RebasedSourceId | null {
  if (typeof value !== "string" || !/^[a-z-]+:.+$/u.test(value)) return null;
  return value as RebasedSourceId;
}

function parseBinding(value: unknown): RebasedActionBinding | null {
  if (!isRecord(value)) return null;
  const sourceId = parseSourceId(value.sourceId);
  const featureGroup = parseFeatureGroup(value.featureGroup);
  if (sourceId === null || featureGroup === null) return null;
  const requiredStrings = [
    value.commandId,
    value.uiSurface,
    value.nativeBoundary,
    value.testSurface,
    value.effectKind,
    value.visibleWhen,
    value.enabledWhen,
  ];
  if (
    requiredStrings.some((entry) => typeof entry !== "string" || entry.trim() === "") ||
    (value.checkedWhen !== null && typeof value.checkedWhen !== "string")
  ) {
    return null;
  }
  if (
    value.effectKind !== "none" &&
    value.effectKind !== "workspace" &&
    value.effectKind !== "git-read" &&
    value.effectKind !== "git-write" &&
    value.effectKind !== "network" &&
    value.effectKind !== "filesystem-read" &&
    value.effectKind !== "filesystem-write" &&
    value.effectKind !== "settings"
  ) {
    return null;
  }
  return {
    sourceId,
    commandId: String(value.commandId),
    featureGroup,
    uiSurface: String(value.uiSurface),
    nativeBoundary: String(value.nativeBoundary),
    testSurface: String(value.testSurface),
    effectKind: value.effectKind,
    visibleWhen: String(value.visibleWhen),
    enabledWhen: String(value.enabledWhen),
    checkedWhen: typeof value.checkedWhen === "string" ? value.checkedWhen : null,
  };
}

function parseBindings(value: unknown): readonly RebasedActionBinding[] {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.bindings)) {
    throw new Error("Rebased action bindings must use schema version 1");
  }
  const bindings = value.bindings.map(parseBinding);
  if (bindings.some((binding) => binding === null)) {
    throw new Error("Rebased action bindings contain an invalid entry");
  }
  return bindings.filter((binding): binding is RebasedActionBinding => binding !== null);
}

function parseRegistrySourceIds(value: unknown): ReadonlySet<RebasedSourceId> {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.entries)) {
    throw new Error("Rebased action registry must use schema version 1");
  }
  const entries = value.entries.flatMap((entry): readonly RebasedRegistryEntry[] => {
    if (!isRecord(entry)) return [];
    const sourceId = parseSourceId(entry.sourceId);
    return sourceId === null ? [] : [{ sourceId }];
  });
  if (entries.length !== value.entries.length) {
    throw new Error("Rebased action registry contains an invalid source ID");
  }
  return new Set(entries.map((entry) => entry.sourceId));
}

const bindings = parseBindings(rawBindings);
const sourceIds = parseRegistrySourceIds(rawRegistry);
for (const binding of bindings) {
  if (!sourceIds.has(binding.sourceId)) {
    throw new Error(`Rebased action binding is absent from the source oracle: ${binding.sourceId}`);
  }
}

export const REBASED_ACTION_BINDINGS: readonly RebasedActionBinding[] = bindings;

function sourceIdsForGroup(group: RebasedFeatureGroup): readonly RebasedSourceId[] {
  return bindings
    .filter((binding) => binding.featureGroup === group)
    .map((binding) => binding.sourceId);
}

export const REBASED_FEATURE_GROUPS = Object.freeze({
  shell: sourceIdsForGroup("shell"),
  project: sourceIdsForGroup("project"),
  log: sourceIdsForGroup("log"),
  changes: sourceIdsForGroup("changes"),
  editor: sourceIdsForGroup("editor"),
  refs: sourceIdsForGroup("refs"),
  synchronization: sourceIdsForGroup("synchronization"),
  "history-rewrite": sourceIdsForGroup("history-rewrite"),
  conflicts: sourceIdsForGroup("conflicts"),
  github: sourceIdsForGroup("github"),
  gitlab: sourceIdsForGroup("gitlab"),
  hosting: sourceIdsForGroup("hosting"),
  platform: sourceIdsForGroup("platform"),
}) satisfies Readonly<Record<RebasedFeatureGroup, readonly RebasedSourceId[]>>;

export function rebasedActionIds(): readonly RebasedSourceId[] {
  return REBASED_ACTION_BINDINGS.map((binding) => binding.sourceId);
}
