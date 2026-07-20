import { describe, expect, it } from "vitest";
import {
  GitRequestCancelledError,
  isGitRequestCancelled,
  isRetryableOperation,
  operationActivityLabel,
  sanitizeGitError,
} from "./gitActivity";

describe("Git activity", () => {
  it("uses safe user-facing operation labels", () => {
    expect(operationActivityLabel({ kind: "fetch", remote: "origin", prune: false })).toBe(
      "Fetching",
    );
    expect(
      operationActivityLabel({
        kind: "setConfig",
        key: "credential.helper",
        value: "secret",
      }),
    ).toBe("Updating Git config");
  });

  it("allows retry only for the idempotent fetch operation", () => {
    expect(isRetryableOperation({ kind: "fetch", remote: null, prune: false })).toBe(true);
    expect(isRetryableOperation({ kind: "pull", rebase: false })).toBe(false);
  });

  it("redacts credentials and control characters from errors", () => {
    const sanitized = sanitizeGitError(
      "fatal:\u0000 https://user:password@github.com/org/repo token=ghp_secret glpat-private",
    );
    expect(sanitized).toBe(
      "fatal: https://[redacted]@github.com/org/repo token=[redacted] [redacted]",
    );
    expect(sanitized).not.toContain("password");
    expect(sanitized).not.toContain("secret");
  });

  it("distinguishes cancellation from ordinary failures", () => {
    expect(isGitRequestCancelled(new GitRequestCancelledError())).toBe(true);
    expect(isGitRequestCancelled(new Error("failed"))).toBe(false);
  });
});
