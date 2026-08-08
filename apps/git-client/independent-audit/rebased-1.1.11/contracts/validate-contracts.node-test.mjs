import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { requiredSurfaceIds, validateContracts } from "./validate-contracts.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const contract = JSON.parse(readFileSync(resolve(directory, "surface-contracts.json"), "utf8"));

test("covers every independent Rebased 1.1.11 surface", () => {
  const result = validateContracts(contract);
  assert.equal(result.status, "valid");
  assert.equal(result.surfaceCount, requiredSurfaceIds.length);
});

test("rejects observed measurements without traceable evidence", () => {
  const invalid = structuredClone(contract);
  invalid.surfaces[0].source.status = "observed";
  assert.throws(() => validateContracts(invalid), /observed source needs evidence ids/);
});

test("rejects existing parity test paths as baseline mappings", () => {
  const invalid = structuredClone(contract);
  invalid.surfaces[0].implementation.tests.push("scripts/parity/a-test.ts");
  assert.throws(() => validateContracts(invalid), /forbidden parity test path/);
});
