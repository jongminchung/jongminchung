import { describe, expect, it } from "vitest";
import { compareParityScenario, summarizeParityResults } from "./parity-result.mjs";

const reference = {
  id: "project-switcher.keyboard",
  obligationIds: ["action:OpenFile"],
  requiredDimensions: ["structure", "interaction"],
  reference: {
    evidenceVerified: true,
    expected: {
      structure: { actions: ["Open…", "Clone Repository…"] },
      interaction: { initialFocus: "Open…" },
    },
  },
} as const;

describe("parity comparison", () => {
  it("derives equality from independent reference and candidate observations", () => {
    const result = compareParityScenario(reference, {
      scenarioId: reference.id,
      buildHash: "candidate-1",
      observed: {
        structure: { actions: ["Open…", "Clone Repository…"] },
        interaction: { initialFocus: "Open…" },
      },
    });

    expect(result.status).toBe("equal");
    expect(result.dimensions).toEqual([
      { dimension: "structure", status: "equal" },
      { dimension: "interaction", status: "equal" },
    ]);
  });

  it("fails closed when evidence or a required observation is missing", () => {
    const unverifiedReference = {
      ...reference,
      reference: { ...reference.reference, evidenceVerified: false },
    };

    expect(
      compareParityScenario(unverifiedReference, {
        scenarioId: reference.id,
        buildHash: "candidate-1",
        observed: reference.reference.expected,
      }).status,
    ).toBe("unverified");
    expect(
      compareParityScenario(reference, {
        scenarioId: reference.id,
        buildHash: "candidate-1",
        observed: { structure: reference.reference.expected.structure },
      }).status,
    ).toBe("unverified");
  });

  it("invalidates a candidate observation from an older build", () => {
    expect(
      compareParityScenario(
        reference,
        {
          scenarioId: reference.id,
          buildHash: "old-build",
          observed: reference.reference.expected,
        },
        "current-build",
      ).status,
    ).toBe("invalid");
  });

  it("reports only the first compact difference for a divergent dimension", () => {
    const result = compareParityScenario(reference, {
      scenarioId: reference.id,
      buildHash: "candidate-1",
      observed: {
        structure: { actions: ["Clone Repository…", "Open…"] },
        interaction: { initialFocus: "Clone Repository…" },
      },
    });

    expect(result.status).toBe("divergent");
    expect(result.firstFailure).toEqual({
      scenario: reference.id,
      dimension: "structure",
      path: "actions[0]",
      expected: "Open…",
      actual: "Clone Repository…",
    });
  });

  it("recomputes counts instead of trusting stored totals", () => {
    expect(
      summarizeParityResults([
        { scenarioId: "equal", status: "equal", obligationIds: ["a"] },
        { scenarioId: "different", status: "divergent", obligationIds: ["b"] },
        { scenarioId: "missing", status: "unverified", obligationIds: ["c", "d"] },
      ]),
    ).toMatchObject({ total: 4, passed: 1, failed: 1, unverified: 2, status: "failed" });
  });

  it.each([
    ["removed control", { structure: { actions: ["Open…"] } }],
    ["renamed control", { structure: { actions: ["Open", "Clone Repository…"] } }],
    ["reordered control", { structure: { actions: ["Clone Repository…", "Open…"] } }],
    ["changed focus", { interaction: { initialFocus: "Clone Repository…" } }],
  ])("detects the %s mutation", (_label, mutation) => {
    const observed = {
      structure: reference.reference.expected.structure,
      interaction: reference.reference.expected.interaction,
      ...mutation,
    };

    expect(
      compareParityScenario(reference, {
        scenarioId: reference.id,
        buildHash: "candidate-1",
        observed,
      }).status,
    ).toBe("divergent");
  });

  it.each([
    ["visual geometry", "visual", { bounds: [0, 0, 400, 300] }, { bounds: [1, 0, 400, 300] }],
    ["Git ref", "effects", { head: "abc", index: ["a.txt"] }, { head: "def", index: ["a.txt"] }],
  ] as const)("detects the %s mutation", (_label, dimension, expected, actual) => {
    const mutationReference = {
      id: `mutation.${dimension}`,
      obligationIds: [`mutation:${dimension}`],
      requiredDimensions: [dimension],
      reference: { evidenceVerified: true, expected: { [dimension]: expected } },
    };

    expect(
      compareParityScenario(mutationReference, {
        scenarioId: mutationReference.id,
        buildHash: "candidate-1",
        observed: { [dimension]: actual },
      }).status,
    ).toBe("divergent");
  });
});
