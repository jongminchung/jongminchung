import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const contractPath = resolve(directory, "surface-contracts.json");
const schemaPath = resolve(directory, "ui-measurement.schema.json");

export const requiredSurfaceIds = Object.freeze([
  "welcome",
  "workbench-clean",
  "workbench-dirty",
  "log-diff",
  "changes-commit",
  "branch",
  "push-lease",
  "stash",
  "conflict",
  "rebase",
]);

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateContracts(contract = readJson(contractPath), schema = readJson(schemaPath)) {
  assert(schema.$schema === "https://json-schema.org/draft/2020-12/schema", "Schema draft must be 2020-12");
  assert(contract.contractVersion === 1, "contractVersion must be 1");
  assert(contract.baseline?.product === "Rebased", "baseline product must be Rebased");
  assert(contract.baseline?.version === "1.1.11", "baseline version must be 1.1.11");
  assert(contract.baseline?.platform === "macOS", "baseline platform must be macOS");
  assert(contract.baseline?.architecture === "arm64", "baseline architecture must be arm64");
  assert(Array.isArray(contract.surfaces), "surfaces must be an array");

  const ids = contract.surfaces.map((surface) => surface.id);
  assert(new Set(ids).size === ids.length, "surface ids must be unique");
  for (const id of requiredSurfaceIds) assert(ids.includes(id), `Missing required surface: ${id}`);

  for (const surface of contract.surfaces) {
    const prefix = `surface ${surface.id}`;
    assert(Number.isInteger(surface.viewport?.width), `${prefix} needs an integer viewport width`);
    assert(Number.isInteger(surface.viewport?.height), `${prefix} needs an integer viewport height`);
    assert(surface.viewport.width > 0 && surface.viewport.height > 0, `${prefix} viewport must be positive`);
    assert(surface.measurements?.rectangles?.length > 0, `${prefix} needs rectangle requests`);
    assert(surface.measurements?.texts?.length > 0, `${prefix} needs text requests`);
    assert(surface.implementation?.entrypoints?.length > 0, `${prefix} needs implementation entrypoints`);
    assert(surface.implementation?.components?.length > 0, `${prefix} needs component mappings`);
    assert(surface.implementation?.stateOwners?.length > 0, `${prefix} needs state mappings`);
    assert(surface.source?.product === "Rebased", `${prefix} source product must be Rebased`);
    assert(surface.source?.version === "1.1.11", `${prefix} source version must be 1.1.11`);
    assert(["pending", "observed"].includes(surface.source?.status), `${prefix} has invalid source status`);

    const measurementIds = [
      ...surface.measurements.rectangles.map((measurement) => measurement.id),
      ...surface.measurements.texts.map((measurement) => measurement.id),
      ...surface.measurements.colors.map((measurement) => measurement.id),
    ];
    assert(new Set(measurementIds).size === measurementIds.length, `${prefix} measurement ids must be unique`);

    const observedValues = [
      ...surface.measurements.rectangles.map((measurement) => measurement.value),
      ...surface.measurements.texts.map((measurement) => measurement.value),
      ...surface.measurements.colors.map((measurement) => measurement.value),
    ];
    if (surface.source.status === "observed") {
      assert(surface.source.evidenceIds.length > 0, `${prefix} observed source needs evidence ids`);
      assert(typeof surface.source.capturedAt === "string", `${prefix} observed source needs capturedAt`);
      assert(observedValues.some((value) => value !== null), `${prefix} observed source needs values`);
    } else {
      assert(surface.source.evidenceIds.length === 0, `${prefix} pending source cannot cite evidence`);
      assert(observedValues.every((value) => value === null), `${prefix} pending source cannot contain values`);
    }

    for (const testPath of surface.implementation.tests) {
      assert(!testPath.includes("parity/"), `${prefix} maps a forbidden parity test path: ${testPath}`);
      assert(!testPath.includes("parity."), `${prefix} maps a forbidden parity test name: ${testPath}`);
    }
  }

  return { surfaceCount: contract.surfaces.length, status: "valid" };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = validateContracts();
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
