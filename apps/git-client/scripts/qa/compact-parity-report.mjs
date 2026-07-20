import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

async function readJson(path) {
  return JSON.parse(await readFile(resolve(appRoot, path), "utf8"));
}

export function buildCompactParityReport(coverage, bridge, completion) {
  return {
    schemaVersion: 1,
    complete: completion.complete === true,
    releaseDecision: completion.releaseDecision,
    sourceToRuntime: {
      resolved: coverage.sourceToRuntime.resolved,
      total: coverage.sourceToRuntime.total,
      percent: coverage.sourceToRuntime.coverage,
    },
    runtimeToSource: {
      mapped: coverage.runtimeToSource.mapped,
      total: coverage.runtimeToSource.total,
      percent: coverage.runtimeToSource.coverage,
    },
    gitBridge: {
      packageVerified: bridge.summary.packageVerified,
      rebasedVerified: bridge.summary.rebasedVerified,
      total: bridge.summary.contractMethods,
    },
    blockers: completion.blockingGates,
  };
}

export async function writeCompactParityReport() {
  const [coverage, bridge, completion] = await Promise.all([
    readJson("parity/rebased/1.1.8/reports/coverage.json"),
    readJson("parity/rebased/1.1.8/reports/electron-bridge-support.json"),
    readJson("parity/rebased/1.1.8/reports/completion.json"),
  ]);
  const report = buildCompactParityReport(coverage, bridge, completion);
  const outputFile = resolve(appRoot, "test-results/qa/parity.json");
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const source = report.sourceToRuntime;
  const runtime = report.runtimeToSource;
  const gitBridge = report.gitBridge;
  console.log(
    `[qa:parity] complete=${report.complete} source=${source.resolved}/${source.total} runtime=${runtime.mapped}/${runtime.total} bridge-package=${gitBridge.packageVerified}/${gitBridge.total} bridge-rebased=${gitBridge.rebasedVerified}/${gitBridge.total} blockers=${report.blockers.length}; report=test-results/qa/parity.json`,
  );
  return report;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const report = await writeCompactParityReport();
  if (!report.complete) process.exitCode = 1;
}
