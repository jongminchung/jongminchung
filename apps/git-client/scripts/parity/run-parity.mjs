#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateParityCompletion } from "./check-completion.mjs";
import { buildCurrentCompletionInput, writeParityArtifacts } from "./parity-workspace.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const MAX_CONSOLE_BYTES = 8_000;

export function selectNextParityItems(details, limit = 5) {
  const obligations = Array.isArray(details.obligations) ? details.obligations : [];
  const priority = (item) => {
    if (item.status === "divergent") return 0;
    if (item.status === "invalid") return 1;
    if (Array.isArray(item.scenarioIds) && item.scenarioIds.length > 0) return 2;
    return 3;
  };
  return [...obligations]
    .filter((item) => item.status !== "equal")
    .sort((left, right) => priority(left) - priority(right))
    .slice(0, Math.max(0, limit));
}

export function explainParityItem(details, id) {
  const scenarios = Array.isArray(details.scenarioResults) ? details.scenarioResults : [];
  const obligations = Array.isArray(details.obligations) ? details.obligations : [];
  const scenario = scenarios.find((item) => item.scenarioId === id);
  if (scenario) {
    return {
      scenario,
      obligations: obligations.filter(
        (item) => Array.isArray(item.scenarioIds) && item.scenarioIds.includes(id),
      ),
    };
  }
  const obligation = obligations.find((item) => item.obligationId === id);
  return obligation ? { obligation } : null;
}

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? null) : null;
}

async function runTool(label, command, args, logs) {
  const result = spawnSync(command, args, {
    cwd: appRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  logs.push(`$ ${command} ${args.join(" ")}\n${output}`);
  return {
    label,
    passed: result.status === 0,
    exitCode: result.status ?? 1,
    firstFailure:
      result.status === 0
        ? null
        : (output
            .split("\n")
            .map((line) => line.trim())
            .find((line) => /fail|error|incomplete/iu.test(line)) ?? `${label} failed`),
  };
}

async function saveCommandLog(mode, logs) {
  const directory = resolve(appRoot, "test-results/parity/commands");
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, `${mode}.log`);
  await writeFile(path, `${logs.join("\n\n")}\n`, "utf8");
  return `test-results/parity/commands/${mode}.log`;
}

async function currentDetails() {
  const input = await buildCurrentCompletionInput({ appRoot });
  return {
    input,
    details: { scenarioResults: input.scenarioResults, obligations: input.obligations },
  };
}

async function printInventory(mode, args) {
  const { input, details } = await currentDetails();
  if (mode === "next") {
    const limitValue = Number(option(args, "--limit") ?? "5");
    const items = selectNextParityItems(details, Number.isFinite(limitValue) ? limitValue : 5);
    console.log(JSON.stringify({ status: "ok", build: input.expectedBuildHash, items }));
    return;
  }
  const id = args[1];
  if (!id) throw new Error("parity:explain requires a scenario or obligation id");
  const explanation = explainParityItem(details, id);
  console.log(JSON.stringify({ status: explanation ? "ok" : "not-found", id, explanation }));
  if (!explanation) process.exitCode = 1;
}

async function runVerification(mode, args) {
  const logs = [];
  const steps = [];
  steps.push(
    await runTool(
      "meta",
      "pnpm",
      [
        "exec",
        "vitest",
        "run",
        "--root",
        "../..",
        "apps/git-client/scripts/parity",
        "apps/git-client/scripts/qa",
        "--reporter=agent",
        "--silent=passed-only",
      ],
      logs,
    ),
  );

  if (steps.at(-1).passed && mode === "test") {
    const scenarioId = option(args, "--scenario");
    if (!scenarioId) throw new Error("parity:test requires --scenario <id>");
    steps.push(
      await runTool(
        "renderer",
        "pnpm",
        [
          "exec",
          "playwright",
          "test",
          "tests/rebased-contracts.spec.ts",
          "--grep",
          `\\[parity:${scenarioId}\\]`,
        ],
        logs,
      ),
    );
  } else if (steps.at(-1).passed && mode === "affected") {
    steps.push(
      await runTool(
        "renderer",
        "pnpm",
        ["exec", "playwright", "test", "tests/rebased-contracts.spec.ts"],
        logs,
      ),
    );
  } else if (steps.at(-1).passed && mode === "full") {
    steps.push(await runTool("renderer", "pnpm", ["test:e2e"], logs));
    if (steps.at(-1).passed) {
      steps.push(await runTool("electron", "pnpm", ["test:electron"], logs));
    }
  }

  const input = await buildCurrentCompletionInput({ appRoot });
  const parity = evaluateParityCompletion(input);
  const artifactPath = await writeParityArtifacts(input, parity);
  const logPath = await saveCommandLog(mode, logs);
  const toolFailure = steps.find((step) => !step.passed);
  const output = {
    status: !toolFailure && parity.complete ? "passed" : "failed",
    build: input.expectedBuildHash,
    total: parity.counts.total,
    passed: parity.counts.passed,
    failed: parity.counts.failed,
    unverified: parity.counts.unverified,
    invalid: parity.counts.invalid,
    firstFailure: toolFailure?.firstFailure ?? parity.failures[0] ?? null,
    artifacts: artifactPath,
    log: logPath,
  };
  const serialized = JSON.stringify(output);
  console.log(
    serialized.length <= MAX_CONSOLE_BYTES
      ? serialized
      : JSON.stringify({ ...output, firstFailure: "See command log" }),
  );
  if (output.status !== "passed") process.exitCode = 1;
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0];
  if (mode === "next" || mode === "explain") {
    await printInventory(mode, args);
    return;
  }
  if (mode === "test" || mode === "affected" || mode === "full") {
    await runVerification(mode, args);
    return;
  }
  throw new Error("Expected one of: test, affected, full, next, explain");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
