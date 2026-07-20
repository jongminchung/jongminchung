import { describe, expect, it } from "vitest";
import { explainParityItem, selectNextParityItems } from "./run-parity.mjs";

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
});
