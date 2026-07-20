#!/usr/bin/env node

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_SOURCE_OBLIGATIONS = 7_260;
const EXPECTED_GIT_BRIDGE_METHODS = 43;
const REQUIRED_RELEASE_GATES = Object.freeze([
  "package-e2e",
  "performance",
  "soak",
  "developer-id",
  "notarization",
]);

function uniqueBy(values, key) {
  return new Map(values.map((value) => [value[key], value]));
}

function currentStatus(result, expectedBuildHash) {
  return result.buildHash === expectedBuildHash ? result.status : "invalid";
}

export function evaluateParityCompletion(input) {
  const failures = [];
  const obligations = Array.isArray(input.obligations) ? input.obligations : [];
  const obligationById = uniqueBy(obligations, "obligationId");
  if (obligationById.size !== EXPECTED_SOURCE_OBLIGATIONS) {
    failures.push(
      `source obligations: expected ${EXPECTED_SOURCE_OBLIGATIONS} unique results, received ${obligationById.size}`,
    );
  }

  const counts = { total: obligationById.size, passed: 0, failed: 0, unverified: 0, invalid: 0 };
  let staleResults = 0;
  for (const result of obligationById.values()) {
    const status = currentStatus(result, input.expectedBuildHash);
    if (status === "equal") counts.passed += 1;
    else if (status === "divergent") counts.failed += 1;
    else if (status === "unverified") counts.unverified += 1;
    else counts.invalid += 1;
    if (result.buildHash !== input.expectedBuildHash) staleResults += 1;
  }
  if (counts.failed > 0) failures.push(`source obligations: ${counts.failed} divergent`);
  if (counts.unverified > 0) failures.push(`source obligations: ${counts.unverified} unverified`);
  if (counts.invalid > 0) failures.push(`source obligations: ${counts.invalid} invalid`);
  if (staleResults > 0) {
    failures.push(`candidate evidence: ${staleResults} result(s) belong to another build`);
  }
  if (input.referenceVerified !== true) failures.push("reference evidence: unverified");

  const bridgeMethods = Array.isArray(input.bridgeMethods) ? input.bridgeMethods : [];
  const bridgeByMethod = uniqueBy(bridgeMethods, "method");
  const bridgePassed = [...bridgeByMethod.values()].filter(
    (result) => currentStatus(result, input.expectedBuildHash) === "equal",
  ).length;
  const bridge = {
    total: bridgeByMethod.size,
    passed: bridgePassed,
    unverified: bridgeByMethod.size - bridgePassed,
  };
  if (bridge.total !== EXPECTED_GIT_BRIDGE_METHODS) {
    failures.push(
      `GitBridge methods: expected ${EXPECTED_GIT_BRIDGE_METHODS} unique results, received ${bridge.total}`,
    );
  }
  if (bridge.passed !== EXPECTED_GIT_BRIDGE_METHODS) {
    failures.push(`GitBridge methods: ${bridge.unverified} unverified`);
  }

  const releaseGates = Array.isArray(input.releaseGates) ? input.releaseGates : [];
  const releaseByGate = uniqueBy(releaseGates, "gate");
  for (const gate of REQUIRED_RELEASE_GATES) {
    const result = releaseByGate.get(gate);
    if (!result) {
      failures.push(`release gate ${gate}: missing`);
      continue;
    }
    const status = currentStatus(result, input.expectedBuildHash);
    if (status !== "passed") failures.push(`release gate ${gate}: ${status}`);
  }

  return Object.freeze({
    complete: failures.length === 0,
    counts: Object.freeze(counts),
    bridge: Object.freeze(bridge),
    failures: Object.freeze(failures),
  });
}

export function assertParityComplete(input) {
  const result = evaluateParityCompletion(input);
  if (!result.complete) {
    const compactFailures = result.failures
      .slice(0, 5)
      .map((failure) => `- ${failure}`)
      .join("\n");
    throw new Error(`Rebased 1.1.8 parity is incomplete:\n${compactFailures}`);
  }
  return result;
}

async function main() {
  const { buildCurrentCompletionInput, writeParityArtifacts } =
    await import("./parity-workspace.mjs");
  const input = await buildCurrentCompletionInput();
  const result = evaluateParityCompletion(input);
  const artifactPath = await writeParityArtifacts(input, result);
  console.log(
    JSON.stringify({
      status: result.complete ? "passed" : "failed",
      build: input.expectedBuildHash,
      ...result.counts,
      gitBridge: result.bridge,
      firstFailure: result.failures[0] ?? null,
      artifacts: artifactPath,
    }),
  );
  if (!result.complete) process.exitCode = 1;
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
