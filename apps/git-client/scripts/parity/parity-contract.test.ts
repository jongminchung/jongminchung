import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildObligationInventory,
  parseCandidateObservation,
  parseParityContractIndex,
} from "./parity-contract.mjs";

const appRoot = resolve(import.meta.dirname, "../..");

describe("parity contract coverage", () => {
  it("represents all 7,260 source obligations and fails closed for unmapped work", () => {
    const actionRegistry = JSON.parse(
      readFileSync(resolve(appRoot, "parity/rebased/1.1.8/source/action-registry.json"), "utf8"),
    ) as unknown;
    const contracts = parseParityContractIndex(
      JSON.parse(
        readFileSync(resolve(appRoot, "parity/rebased/1.1.8/contracts/index.json"), "utf8"),
      ) as unknown,
    );

    const inventory = buildObligationInventory(actionRegistry, contracts, []);

    expect(inventory.results).toHaveLength(7_260);
    expect(inventory.summary).toMatchObject({
      total: 7_260,
      status: "failed",
      unverified: 7_260,
    });
    expect(new Set(inventory.results.map((result) => result.obligationId)).size).toBe(7_260);
  });

  it("rejects duplicate scenario and obligation mappings", () => {
    expect(() =>
      parseParityContractIndex({
        schemaVersion: 1,
        referenceVersion: "1.1.8",
        scenarios: [
          {
            id: "duplicate",
            testId: "one",
            obligationIds: ["action:OpenFile", "action:OpenFile"],
            requiredDimensions: ["structure"],
            reference: {
              authority: "legacy-manual",
              evidenceIds: [],
              evidenceVerified: false,
              expected: { structure: {} },
            },
          },
        ],
      }),
    ).toThrow();
  });

  it("validates candidate observations at the filesystem boundary", () => {
    expect(() =>
      parseCandidateObservation({ scenarioId: "scenario", buildHash: "", observed: {} }),
    ).toThrow();
    expect(
      parseCandidateObservation({
        scenarioId: "scenario",
        buildHash: "0123456789abcdef",
        observed: { structure: { actions: [] } },
      }),
    ).toMatchObject({ scenarioId: "scenario", buildHash: "0123456789abcdef" });
  });
});
