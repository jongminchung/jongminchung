import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { evaluateParityCompletion } from "../parity/check-completion.mjs";
import { buildCurrentCompletionInput, writeParityArtifacts } from "../parity/parity-workspace.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export function buildCompactParityReport(input, result) {
  return Object.freeze({
    schemaVersion: 2,
    status: result.complete ? "passed" : "failed",
    referenceVersion: input.referenceVersion,
    build: input.expectedBuildHash,
    ...result.counts,
    gitBridge: result.bridge,
    failures: result.failures.slice(0, 5),
  });
}

export async function writeCompactParityReport() {
  const input = await buildCurrentCompletionInput({ appRoot });
  const result = evaluateParityCompletion(input);
  const report = buildCompactParityReport(input, result);
  const outputFile = resolve(appRoot, "test-results/qa/parity.json");
  await mkdir(dirname(outputFile), { recursive: true });
  await Promise.all([
    writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeParityArtifacts(input, result),
  ]);
  console.log(
    `[qa:parity] status=${report.status} build=${report.build} obligations=${report.passed}/${report.total} divergent=${report.failed} unverified=${report.unverified} invalid=${report.invalid} bridge=${report.gitBridge.passed}/${report.gitBridge.total}; report=${relative(appRoot, outputFile)}`,
  );
  return report;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const report = await writeCompactParityReport();
  if (report.status !== "passed") process.exitCode = 1;
}
