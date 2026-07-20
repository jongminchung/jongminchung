import { describe, expect, it } from "vitest";
import { buildCompactParityReport } from "./compact-parity-report.mjs";

describe("compact parity report", () => {
  it("keeps gate counts and blockers without copying inventories", () => {
    expect(
      buildCompactParityReport(
        {
          sourceToRuntime: {
            resolved: 219,
            total: 7_260,
            coverage: 3.016529,
          },
          runtimeToSource: {
            mapped: 14,
            total: 22,
            coverage: 63.636364,
          },
        },
        {
          summary: {
            contractMethods: 43,
            packageVerified: 43,
            rebasedVerified: 0,
          },
        },
        {
          complete: false,
          releaseDecision: "blocked",
          blockingGates: ["visual comparison pending"],
        },
      ),
    ).toEqual({
      schemaVersion: 1,
      complete: false,
      releaseDecision: "blocked",
      sourceToRuntime: { resolved: 219, total: 7_260, percent: 3.016529 },
      runtimeToSource: { mapped: 14, total: 22, percent: 63.636364 },
      gitBridge: { packageVerified: 43, rebasedVerified: 0, total: 43 },
      blockers: ["visual comparison pending"],
    });
  });
});
