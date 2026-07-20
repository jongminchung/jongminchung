#!/usr/bin/env node

import { closeSync, fsyncSync, openSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectSourceObligations,
  DEFAULT_PARITY_ROOT,
  loadMappingInputs,
} from "./build-mapping-ledger.mjs";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_APP_ROOT = resolve(SCRIPT_DIRECTORY, "../..");

const FEATURE_GROUPS = Object.freeze([
  "shell",
  "project",
  "log",
  "changes",
  "editor",
  "refs",
  "synchronization",
  "history-rewrite",
  "conflicts",
  "github",
  "gitlab",
  "hosting",
  "platform",
]);

const EFFECT_KINDS = Object.freeze([
  "none",
  "workspace",
  "git-read",
  "git-write",
  "network",
  "filesystem-read",
  "filesystem-write",
  "settings",
]);

function compareText(left, right) {
  return String(left).localeCompare(String(right), "en");
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, child]) => [key, stableValue(child)]),
  );
}

function stableJson(value) {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function requireOneOf(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new Error(`${label} has unsupported value: ${String(value)}`);
  }
  return value;
}

function parseBinding(value, index) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Action binding ${index} must be an object`);
  }
  return {
    checkedWhen:
      value.checkedWhen === null
        ? null
        : requireNonEmptyString(value.checkedWhen, `Action binding ${index}.checkedWhen`),
    commandId: requireNonEmptyString(value.commandId, `Action binding ${index}.commandId`),
    effectKind: requireOneOf(value.effectKind, EFFECT_KINDS, `Action binding ${index}.effectKind`),
    enabledWhen: requireNonEmptyString(value.enabledWhen, `Action binding ${index}.enabledWhen`),
    featureGroup: requireOneOf(
      value.featureGroup,
      FEATURE_GROUPS,
      `Action binding ${index}.featureGroup`,
    ),
    nativeBoundary: requireNonEmptyString(
      value.nativeBoundary,
      `Action binding ${index}.nativeBoundary`,
    ),
    sourceId: requireNonEmptyString(value.sourceId, `Action binding ${index}.sourceId`),
    testSurface: requireNonEmptyString(value.testSurface, `Action binding ${index}.testSurface`),
    uiSurface: requireNonEmptyString(value.uiSurface, `Action binding ${index}.uiSurface`),
    visibleWhen: requireNonEmptyString(value.visibleWhen, `Action binding ${index}.visibleWhen`),
  };
}

export function parseActionBindings(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.bindings)
  ) {
    throw new Error("Action bindings must use schema version 1");
  }
  const bindings = value.bindings.map(parseBinding);
  const commandIds = new Set(bindings.map((binding) => binding.commandId));
  if (commandIds.size !== bindings.length) {
    throw new Error("Action bindings contain duplicate command IDs");
  }
  return bindings.sort((left, right) => compareText(left.commandId, right.commandId));
}

function sourceMetadata(source) {
  return new Map(
    [...source.actions.actions, ...source.groups.groups].map((record) => [
      record.stableId,
      {
        children: record.children,
        className: record.className,
        description: record.description,
        icon: record.icon,
        id: record.id,
        internal: record.internal,
        label: record.text,
        parentId: record.parentId,
        popup: record.popup,
        searchable: record.searchable,
        shortcuts: record.shortcuts,
        source: record.source,
        useShortcutOf: record.useShortcutOf,
      },
    ]),
  );
}

function commandById(commandManifest) {
  if (
    commandManifest === null ||
    typeof commandManifest !== "object" ||
    commandManifest.schemaVersion !== 1 ||
    !Array.isArray(commandManifest.commands)
  ) {
    throw new Error("Command manifest must use schema version 1");
  }
  return new Map(commandManifest.commands.map((command) => [command.id, command]));
}

export function buildActionRegistry({
  baseline,
  bindings,
  commandManifest,
  source,
  sourceToRuntime,
}) {
  const obligations = collectSourceObligations(source);
  const obligationIds = new Set(obligations.map((obligation) => obligation.stableId));
  const commands = commandById(commandManifest);
  const bindingsBySource = new Map();
  for (const binding of bindings) {
    if (!obligationIds.has(binding.sourceId)) {
      throw new Error(`Action binding references missing source obligation: ${binding.sourceId}`);
    }
    const command = commands.get(binding.commandId);
    if (command === undefined) {
      throw new Error(`Action binding references missing command: ${binding.commandId}`);
    }
    const existing = bindingsBySource.get(binding.sourceId) ?? [];
    existing.push({ ...binding, command });
    bindingsBySource.set(binding.sourceId, existing);
  }
  if (bindings.length !== commands.size) {
    const unbound = [...commands.keys()].filter(
      (commandId) => !bindings.some((binding) => binding.commandId === commandId),
    );
    throw new Error(`Commands without source bindings: ${unbound.join(", ")}`);
  }

  const sourceMapping = new Map(sourceToRuntime.entries.map((entry) => [entry.sourceId, entry]));
  const metadata = sourceMetadata(source);
  const entries = obligations.map((obligation) => {
    const mapping = sourceMapping.get(obligation.stableId);
    if (mapping === undefined) {
      throw new Error(`Mapping ledger is missing source obligation: ${obligation.stableId}`);
    }
    return {
      candidateBindings: (bindingsBySource.get(obligation.stableId) ?? []).sort((left, right) =>
        compareText(left.commandId, right.commandId),
      ),
      classification: mapping.classification,
      declarationCount: obligation.declarationCount,
      kind: obligation.kind,
      sourceFiles: mapping.sourceFiles,
      sourceId: obligation.stableId,
      sourceMetadata: metadata.get(obligation.stableId) ?? null,
      sourceOccurrenceCount: obligation.sourceOccurrenceCount,
      status: mapping.status,
    };
  });

  return {
    schemaVersion: 1,
    reference: {
      build: baseline.reference.build,
      tagSha: baseline.reference.tagSha,
      version: baseline.reference.version,
    },
    generatedBy: "scripts/parity/build-action-registry.mjs",
    summary: {
      boundCandidateCommands: bindings.length,
      sourceObligations: entries.length,
      sourceObligationsWithCandidateBindings: entries.filter(
        (entry) => entry.candidateBindings.length > 0,
      ).length,
      unresolvedSourceObligations: entries.filter((entry) => entry.classification === "unresolved")
        .length,
    },
    entries,
  };
}

export function loadActionRegistryInputs(
  appRoot = DEFAULT_APP_ROOT,
  parityRoot = DEFAULT_PARITY_ROOT,
) {
  const mappingInputs = loadMappingInputs(parityRoot);
  return {
    ...mappingInputs,
    bindings: parseActionBindings(readJson(join(parityRoot, "manifest", "action-bindings.json"))),
    commandManifest: readJson(join(appRoot, "src", "command-manifest.json")),
    sourceToRuntime: readJson(join(parityRoot, "mappings", "source-to-runtime.json")),
  };
}

export function writeActionRegistry(registry, parityRoot = DEFAULT_PARITY_ROOT) {
  const target = join(parityRoot, "source", "action-registry.json");
  const temporary = `${target}.tmp`;
  const descriptor = openSync(temporary, "w", 0o644);
  try {
    writeFileSync(descriptor, stableJson(registry), "utf8");
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  renameSync(temporary, target);
}

async function main() {
  const inputs = loadActionRegistryInputs();
  writeActionRegistry(buildActionRegistry(inputs));
}

const entryPoint = process.argv[1];
if (entryPoint && resolve(entryPoint) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
