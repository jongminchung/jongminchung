import { describe, expect, it } from "vitest";
import { buildCompactParityReport } from "./compact-parity-report.mjs";

describe("compact parity report", () => {
  it("uses derived current-build counts and caps failures at five", () => {
    const report = buildCompactParityReport(
      { referenceVersion: "1.1.8", expectedBuildHash: "candidate-build" },
      {
        complete: false,
        counts: { total: 7_260, passed: 3, failed: 1, unverified: 7_256, invalid: 0 },
        bridge: { total: 43, passed: 14, unverified: 29 },
        failures: Array.from({ length: 8 }, (_, index) => `failure-${index}`),
      },
    );

    expect(report).toEqual({
      schemaVersion: 2,
      status: "failed",
      referenceVersion: "1.1.8",
      build: "candidate-build",
      total: 7_260,
      passed: 3,
      failed: 1,
      unverified: 7_256,
      invalid: 0,
      gitBridge: { total: 43, passed: 14, unverified: 29 },
      failures: ["failure-0", "failure-1", "failure-2", "failure-3", "failure-4"],
    });
  });
});
