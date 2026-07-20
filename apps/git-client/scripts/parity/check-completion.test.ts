import { describe, expect, it } from "vitest";
import { assertParityComplete, evaluateParityCompletion } from "./check-completion.mjs";

function completeInputs(): Readonly<Record<string, unknown>> {
  return {
    actionRegistry: {
      summary: {
        sourceObligations: 7_260,
        unresolvedSourceObligations: 0,
      },
    },
    sourceToRuntime: {
      summary: { total: 7_260, unresolved: 0, complete: true },
      scope: { complete: true },
    },
    runtimeToSource: {
      summary: { unmappedRuntime: 0, complete: true },
      scope: { actionableNodeEnumerationComplete: true, complete: true },
    },
    bridgeSupport: {
      summary: {
        contractMethods: 43,
        supported: 43,
        packageVerified: 43,
        rebasedVerified: 43,
        partial: 0,
        unsupported: 0,
        emptyFallback: 0,
        noOp: 0,
        complete: true,
      },
      complete: true,
    },
    coverage: {
      sourceToRuntime: { coverage: 100 },
      runtimeToSource: { coverage: 100 },
      unresolved: [],
      complete: true,
    },
    releaseValidation: {
      parityComplete: true,
      packageE2e: { status: "passed" },
    },
    completion: { complete: true, blockingGates: [] },
    unmatched: {
      unresolved: [],
      unmappedRuntime: [],
      provisional: [],
      ambiguous: [],
      uncaptured: [],
      unverified: [],
      complete: true,
    },
  };
}

describe("Rebased parity completion release gate", () => {
  it("passes only when every parity ledger and release report is complete", () => {
    expect(evaluateParityCompletion(completeInputs())).toEqual({
      complete: true,
      failures: [],
    });
    expect(() => assertParityComplete(completeInputs())).not.toThrow();
  });

  it("fails closed for unresolved source, runtime, bridge, and release work", () => {
    const inputs = {
      ...completeInputs(),
      actionRegistry: {
        summary: {
          sourceObligations: 7_260,
          unresolvedSourceObligations: 7_257,
        },
      },
      runtimeToSource: {
        summary: { unmappedRuntime: 8, complete: false },
        scope: { actionableNodeEnumerationComplete: false, complete: false },
      },
      bridgeSupport: {
        summary: {
          contractMethods: 43,
          supported: 43,
          packageVerified: 14,
          rebasedVerified: 0,
          partial: 0,
          unsupported: 0,
          emptyFallback: 0,
          noOp: 0,
          complete: false,
        },
        complete: false,
      },
      releaseValidation: {
        parityComplete: false,
        packageE2e: { status: "passed" },
      },
    };
    const result = evaluateParityCompletion(inputs);
    expect(result.complete).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("7_257".replace("_", "")),
        expect.stringContaining("runtime-to-source unmapped runtime"),
        expect.stringContaining("GitBridge packageVerified"),
        expect.stringContaining("release validation parity completion"),
      ]),
    );
    expect(() => assertParityComplete(inputs)).toThrow("Rebased 1.1.8 parity is incomplete");
  });
});
