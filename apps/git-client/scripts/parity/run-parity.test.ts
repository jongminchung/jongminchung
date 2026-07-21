import { describe, expect, it } from "vitest";
import {
  explainParityItem,
  mvpVerificationSteps,
  selectNextParityItems,
  selectScenarioTestFile,
  verificationCounts,
} from "./run-parity.mjs";

const details = {
  scenarioResults: [
    { scenarioId: "scenario-divergent", status: "divergent", firstFailure: { path: "actions[0]" } },
    { scenarioId: "scenario-unverified", status: "unverified" },
  ],
  obligations: [
    { obligationId: "a", scenarioIds: ["scenario-unverified"], status: "unverified" },
    { obligationId: "b", scenarioIds: ["scenario-divergent"], status: "divergent" },
    { obligationId: "c", scenarioIds: [], status: "unverified", reason: "no-scenario" },
  ],
};

describe("low-token parity selection", () => {
  it("returns divergent work before unverified work and respects the limit", () => {
    expect(selectNextParityItems(details, 2)).toEqual([
      expect.objectContaining({ obligationId: "b", status: "divergent" }),
      expect.objectContaining({ obligationId: "a", status: "unverified" }),
    ]);
  });

  it("explains only the requested scenario or obligation", () => {
    expect(explainParityItem(details, "scenario-divergent")).toEqual({
      scenario: details.scenarioResults[0],
      obligations: [details.obligations[1]],
    });
    expect(explainParityItem(details, "missing")).toBe(null);
  });

  it("routes MVP slices to their isolated renderer contract suite", () => {
    expect(selectScenarioTestFile("shell.welcome")).toBe("tests/mvp-parity.spec.ts");
    expect(selectScenarioTestFile("shell.project-log")).toBe("tests/mvp-parity.spec.ts");
    expect(selectScenarioTestFile("branch-popup.structure")).toBe(
      "tests/rebased-contracts.spec.ts",
    );
  });

  it("keeps renderer work parallel and packaged Electron work serial", () => {
    const steps = mvpVerificationSteps();
    expect(steps.map((step) => step.label)).toEqual([
      "unit-integration",
      "renderer",
      "package",
      "electron",
    ]);
    expect(steps[1]?.args).toContain("--workers=4");
    expect(steps[3]?.args).toContain("playwright.electron.config.ts");
    expect(steps[3]?.args).not.toContain("--workers=4");
  });

  it("does not leak full-parity failures into a passing scoped result", () => {
    expect(
      verificationCounts(
        { total: 7_260, passed: 3, failed: 2, unverified: 7_255, invalid: 0 },
        true,
        true,
      ),
    ).toEqual({ total: 1, passed: 1, failed: 0, unverified: 0, invalid: 0 });
  });
});
