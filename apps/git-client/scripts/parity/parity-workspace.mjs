import { createHash } from "node:crypto";
import { mkdir, opendir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildObligationInventory,
  parseCandidateObservation,
  parseParityContractIndex,
} from "./parity-contract.mjs";
import { compareParityScenario, PARITY_COMPARATOR_VERSION } from "./parity-result.mjs";
import {
  parseReferenceManifest,
  resolveScenarioReference,
  verifyReferenceEvidence,
} from "./reference-evidence.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultAppRoot = resolve(scriptDirectory, "../..");
const buildDirectories = Object.freeze(["electron", "resources", "src"]);
const buildFiles = Object.freeze([
  "forge.config.ts",
  "index.html",
  "package.json",
  "vite.config.ts",
  "vite.main.config.ts",
  "vite.preload.config.ts",
  "vite.renderer.config.ts",
  "vite.terminal.config.ts",
  "vite.utility.config.ts",
]);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function collectFiles(path) {
  let directory;
  try {
    directory = await opendir(path);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
  const files = [];
  for await (const entry of directory) {
    const entryPath = resolve(path, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(entryPath)));
    else if (entry.isFile()) files.push(entryPath);
  }
  return files;
}

export async function computeCandidateBuildHash(appRoot) {
  const files = [];
  for (const directory of buildDirectories)
    files.push(...(await collectFiles(resolve(appRoot, directory))));
  for (const file of buildFiles) {
    const path = resolve(appRoot, file);
    try {
      await readFile(path);
      files.push(path);
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }
  }
  files.sort((left, right) => left.localeCompare(right));
  const hash = createHash("sha256");
  hash.update("git-client-candidate-build-v1\0");
  for (const file of files) {
    hash.update(relative(appRoot, file));
    hash.update("\0");
    hash.update(await readFile(file));
    hash.update("\0");
  }
  return hash.digest("hex").slice(0, 16);
}

async function loadCandidateObservations(appRoot, observationRootOverride) {
  const observationRoot = resolve(
    observationRootOverride ?? resolve(appRoot, "test-results/parity-observations"),
  );
  const files = (await collectFiles(observationRoot))
    .filter((path) => path.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));
  const observations = [];
  for (const file of files) observations.push(parseCandidateObservation(await readJson(file)));
  return observations;
}

function bridgeResults(bridgeSupport, buildHash) {
  return bridgeSupport.methods.map((method) => ({
    method: method.method,
    status:
      method.packageVerification === "passed" && method.rebasedParity === "passed"
        ? "equal"
        : "unverified",
    buildHash,
  }));
}

function releaseResults(releaseValidation, buildHash) {
  const passed = (value) => (value === "passed" ? "passed" : "unverified");
  return [
    { gate: "package-e2e", status: passed(releaseValidation.packageE2e?.status), buildHash },
    { gate: "performance", status: passed(releaseValidation.performance?.status), buildHash },
    { gate: "soak", status: passed(releaseValidation.soak?.status), buildHash },
    { gate: "developer-id", status: passed(releaseValidation.package?.developerId), buildHash },
    { gate: "notarization", status: passed(releaseValidation.package?.notarization), buildHash },
  ];
}

export async function buildCurrentCompletionInput(options = {}) {
  const appRoot = resolve(options.appRoot ?? defaultAppRoot);
  const rebasedRoot = resolve(appRoot, "parity/rebased");
  const current = await readJson(resolve(rebasedRoot, "current.json"));
  const referenceManifestPath = resolve(rebasedRoot, current.referenceManifest);
  const referenceRoot = dirname(referenceManifestPath);
  const referenceManifest = parseReferenceManifest(await readJson(referenceManifestPath));
  if (referenceManifest.reference.version !== current.version) {
    throw new Error(
      `current reference version mismatch: ${String(current.version)} != ${String(referenceManifest.reference.version)}`,
    );
  }
  const referenceIntegrity = await verifyReferenceEvidence(referenceRoot, referenceManifest);
  const contracts = parseParityContractIndex(
    await readJson(resolve(referenceRoot, "contracts/index.json")),
  );
  if (contracts.referenceVersion !== current.version) {
    throw new Error(
      `contract reference version mismatch: ${contracts.referenceVersion} != ${current.version}`,
    );
  }

  const buildHash = await computeCandidateBuildHash(appRoot);
  const observations = await loadCandidateObservations(appRoot, options.observationRoot);
  const observationByScenario = new Map(
    observations.map((observation) => [observation.scenarioId, observation]),
  );
  const scenarioResults = contracts.scenarios.map((scenario) =>
    compareParityScenario(
      {
        ...scenario,
        reference: resolveScenarioReference(
          scenario.reference,
          referenceManifest,
          referenceIntegrity,
        ),
      },
      observationByScenario.get(scenario.id) ?? {
        scenarioId: scenario.id,
        buildHash,
        observed: {},
      },
      buildHash,
    ),
  );
  const actionRegistry = await readJson(resolve(referenceRoot, "source/action-registry.json"));
  const registryReference = actionRegistry.reference ?? {};
  if (
    registryReference.version !== referenceManifest.reference.version ||
    registryReference.build !== referenceManifest.reference.build ||
    registryReference.tagSha !== referenceManifest.reference.sourceCommit
  ) {
    throw new Error("action registry provenance does not match the pinned Rebased reference");
  }
  const inventory = buildObligationInventory(actionRegistry, contracts, scenarioResults);
  const obligations = inventory.results.map((result) => ({ ...result, buildHash }));
  const bridgeSupport = await readJson(
    resolve(referenceRoot, "reports/electron-bridge-support.json"),
  );
  const releaseValidation = await readJson(
    resolve(referenceRoot, "reports/release-validation.json"),
  );

  return Object.freeze({
    appRoot,
    referenceVersion: current.version,
    comparatorVersion: PARITY_COMPARATOR_VERSION,
    expectedBuildHash: buildHash,
    referenceVerified: referenceIntegrity.verified,
    referenceFailures: referenceIntegrity.failures,
    scenarioResults,
    obligations,
    bridgeMethods: bridgeResults(bridgeSupport, buildHash),
    releaseGates: releaseResults(releaseValidation, buildHash),
  });
}

export async function writeParityArtifacts(input, result) {
  const outputDirectory = resolve(
    input.appRoot ?? defaultAppRoot,
    "test-results/parity",
    input.expectedBuildHash,
  );
  await mkdir(outputDirectory, { recursive: true });
  const details = {
    schemaVersion: 1,
    referenceVersion: input.referenceVersion,
    comparatorVersion: input.comparatorVersion,
    build: input.expectedBuildHash,
    referenceVerified: input.referenceVerified,
    referenceFailures: input.referenceFailures,
    scenarioResults: input.scenarioResults,
    obligations: input.obligations,
    bridgeMethods: input.bridgeMethods,
    releaseGates: input.releaseGates,
  };
  const summary = {
    schemaVersion: 1,
    status: result.complete ? "passed" : "failed",
    referenceVersion: input.referenceVersion,
    comparatorVersion: input.comparatorVersion,
    build: input.expectedBuildHash,
    counts: result.counts,
    gitBridge: result.bridge,
    failures: result.failures.slice(0, 5),
  };
  await Promise.all([
    writeFile(resolve(outputDirectory, "details.json"), `${JSON.stringify(details, null, 2)}\n`),
    writeFile(resolve(outputDirectory, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`),
  ]);
  return relative(input.appRoot ?? defaultAppRoot, outputDirectory);
}
