#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PARITY_ROOT = resolve(SCRIPT_DIRECTORY, "../../parity/rebased/1.1.8");

const EXPECTED_SOURCE_OBLIGATIONS = 7_260;
const EXPECTED_GIT_BRIDGE_METHODS = 43;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function field(value, ...path) {
  let current = value;
  for (const segment of path) {
    if (!isRecord(current)) return undefined;
    current = current[segment];
  }
  return current;
}

function requireEqual(failures, actual, expected, label) {
  if (actual !== expected) {
    failures.push(`${label}: expected ${String(expected)}, received ${String(actual)}`);
  }
}

function requireEmptyArray(failures, actual, label) {
  if (!Array.isArray(actual)) {
    failures.push(`${label}: expected an empty array, received ${String(actual)}`);
    return;
  }
  if (actual.length > 0) failures.push(`${label}: ${actual.length} item(s) remain`);
}

export function evaluateParityCompletion(inputs) {
  const failures = [];

  requireEqual(
    failures,
    field(inputs.actionRegistry, "summary", "sourceObligations"),
    EXPECTED_SOURCE_OBLIGATIONS,
    "action-registry source obligations",
  );
  requireEqual(
    failures,
    field(inputs.actionRegistry, "summary", "unresolvedSourceObligations"),
    0,
    "action-registry unresolved source obligations",
  );

  requireEqual(
    failures,
    field(inputs.sourceToRuntime, "summary", "total"),
    EXPECTED_SOURCE_OBLIGATIONS,
    "source-to-runtime total",
  );
  requireEqual(
    failures,
    field(inputs.sourceToRuntime, "summary", "unresolved"),
    0,
    "source-to-runtime unresolved",
  );
  requireEqual(
    failures,
    field(inputs.sourceToRuntime, "summary", "complete"),
    true,
    "source-to-runtime completion",
  );
  requireEqual(
    failures,
    field(inputs.sourceToRuntime, "scope", "complete"),
    true,
    "source-to-runtime scope completion",
  );

  requireEqual(
    failures,
    field(inputs.runtimeToSource, "summary", "unmappedRuntime"),
    0,
    "runtime-to-source unmapped runtime",
  );
  requireEqual(
    failures,
    field(inputs.runtimeToSource, "summary", "complete"),
    true,
    "runtime-to-source completion",
  );
  requireEqual(
    failures,
    field(inputs.runtimeToSource, "scope", "actionableNodeEnumerationComplete"),
    true,
    "runtime actionable-node enumeration",
  );
  requireEqual(
    failures,
    field(inputs.runtimeToSource, "scope", "complete"),
    true,
    "runtime-to-source scope completion",
  );

  requireEqual(
    failures,
    field(inputs.bridgeSupport, "summary", "contractMethods"),
    EXPECTED_GIT_BRIDGE_METHODS,
    "GitBridge contract methods",
  );
  for (const metric of ["supported", "packageVerified", "rebasedVerified"]) {
    requireEqual(
      failures,
      field(inputs.bridgeSupport, "summary", metric),
      EXPECTED_GIT_BRIDGE_METHODS,
      `GitBridge ${metric}`,
    );
  }
  for (const metric of ["partial", "unsupported", "emptyFallback", "noOp"]) {
    requireEqual(
      failures,
      field(inputs.bridgeSupport, "summary", metric),
      0,
      `GitBridge ${metric}`,
    );
  }
  requireEqual(
    failures,
    field(inputs.bridgeSupport, "summary", "complete"),
    true,
    "GitBridge summary completion",
  );
  requireEqual(
    failures,
    field(inputs.bridgeSupport, "complete"),
    true,
    "GitBridge report completion",
  );

  requireEqual(
    failures,
    field(inputs.coverage, "sourceToRuntime", "coverage"),
    100,
    "coverage source-to-runtime percent",
  );
  requireEqual(
    failures,
    field(inputs.coverage, "runtimeToSource", "coverage"),
    100,
    "coverage runtime-to-source percent",
  );
  requireEmptyArray(failures, field(inputs.coverage, "unresolved"), "coverage unresolved");
  requireEqual(failures, field(inputs.coverage, "complete"), true, "coverage completion");

  requireEqual(
    failures,
    field(inputs.releaseValidation, "parityComplete"),
    true,
    "release validation parity completion",
  );
  requireEqual(
    failures,
    field(inputs.releaseValidation, "packageE2e", "status"),
    "passed",
    "release validation package E2E",
  );

  requireEqual(failures, field(inputs.completion, "complete"), true, "completion report");
  requireEmptyArray(
    failures,
    field(inputs.completion, "blockingGates"),
    "completion blocking gates",
  );

  for (const marker of [
    "unresolved",
    "unmappedRuntime",
    "provisional",
    "ambiguous",
    "uncaptured",
    "unverified",
  ]) {
    requireEmptyArray(failures, field(inputs.unmatched, marker), `unmatched ${marker}`);
  }
  requireEqual(failures, field(inputs.unmatched, "complete"), true, "unmatched report completion");

  return Object.freeze({ complete: failures.length === 0, failures });
}

const INPUT_FILES = Object.freeze({
  actionRegistry: "source/action-registry.json",
  bridgeSupport: "reports/electron-bridge-support.json",
  completion: "reports/completion.json",
  coverage: "reports/coverage.json",
  releaseValidation: "reports/release-validation.json",
  runtimeToSource: "mappings/runtime-to-source.json",
  sourceToRuntime: "mappings/source-to-runtime.json",
  unmatched: "reports/unmatched.json",
});

export function loadParityCompletionInputs(parityRoot = DEFAULT_PARITY_ROOT) {
  return Object.fromEntries(
    Object.entries(INPUT_FILES).map(([name, relativePath]) => [
      name,
      readJson(join(parityRoot, relativePath)),
    ]),
  );
}

export function assertParityComplete(inputs) {
  const result = evaluateParityCompletion(inputs);
  if (!result.complete) {
    throw new Error(
      `Rebased 1.1.8 parity is incomplete:\n${result.failures
        .map((failure) => `- ${failure}`)
        .join("\n")}`,
    );
  }
  return result;
}

async function main() {
  assertParityComplete(loadParityCompletionInputs());
  console.log("Rebased 1.1.8 parity completion gate passed.");
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
