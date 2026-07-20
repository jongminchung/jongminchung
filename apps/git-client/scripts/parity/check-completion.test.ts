import { describe, expect, it } from "vitest";
import { assertParityComplete, evaluateParityCompletion } from "./check-completion.mjs";

function completionInput(status: "equal" | "unverified" = "equal") {
  const buildHash = "candidate-build";
  return {
    expectedBuildHash: buildHash,
    referenceVerified: true,
    obligations: Array.from({ length: 7_260 }, (_, index) => ({
      obligationId: `obligation-${index}`,
      status,
      buildHash,
    })),
    bridgeMethods: Array.from({ length: 43 }, (_, index) => ({
      method: `method-${index}`,
      status: "equal" as const,
      buildHash,
    })),
    releaseGates: ["package-e2e", "performance", "soak", "developer-id", "notarization"].map(
      (gate) => ({ gate, status: "passed" as const, buildHash }),
    ),
    storedSummary: { complete: true, passed: 7_260 },
  };
}

describe("current-build parity completion gate", () => {
  it("passes only from complete individual evidence for the current build", () => {
    expect(evaluateParityCompletion(completionInput())).toMatchObject({
      complete: true,
      counts: { total: 7_260, passed: 7_260, failed: 0, unverified: 0, invalid: 0 },
      bridge: { total: 43, passed: 43 },
    });
  });

  it("ignores a stored complete summary when an obligation is unverified", () => {
    const result = evaluateParityCompletion(completionInput("unverified"));

    expect(result.complete).toBe(false);
    expect(result.counts.unverified).toBe(7_260);
    expect(result.failures[0]).toContain("unverified");
    expect(() => assertParityComplete(completionInput("unverified"))).toThrow(
      "Rebased 1.1.8 parity is incomplete",
    );
  });

  it("invalidates otherwise passing evidence from an older candidate build", () => {
    const input = completionInput();
    input.obligations[0] = { ...input.obligations[0], buildHash: "old-build" };

    const result = evaluateParityCompletion(input);

    expect(result.complete).toBe(false);
    expect(result.counts.invalid).toBe(1);
    expect(result.failures).toContain("candidate evidence: 1 result(s) belong to another build");
  });

  it("rejects duplicate ids and missing release gates", () => {
    const input = completionInput();
    input.obligations[1] = { ...input.obligations[1], obligationId: "obligation-0" };
    input.releaseGates = input.releaseGates.filter(({ gate }) => gate !== "soak");

    const result = evaluateParityCompletion(input);

    expect(result.complete).toBe(false);
    expect(result.failures).toEqual(
      expect.arrayContaining([
        "source obligations: expected 7260 unique results, received 7259",
        "release gate soak: missing",
      ]),
    );
  });
});
