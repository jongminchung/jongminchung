import { describe, expect, it } from "vitest";
import type { PushPreview } from "../generated";
import {
  canForceWithLease,
  canNormalPush,
  createPushOperation,
  requiresPushConfirmation,
} from "./push";

const OID = "0123456789012345678901234567890123456789";
const preview = (overrides: Partial<PushPreview> = {}): PushPreview => ({
  sourceBranch: "main",
  sourceRevision: "HEAD",
  localOid: OID.replace(/^0/, "1"),
  remote: "origin",
  remoteRef: "refs/heads/main",
  upstreamConfigured: true,
  setUpstreamDefault: false,
  remoteOid: OID,
  expectedLeaseOid: OID,
  ahead: 1,
  behind: 0,
  fastForward: true,
  newBranch: false,
  commits: [],
  remoteOnlyCommits: [],
  protectedBranch: false,
  checkedAtMs: 0,
  remoteStateError: null,
  warnings: [],
  ...overrides,
});

describe("push policy", () => {
  it("creates normal and exact-lease operations without a boolean force path", () => {
    expect(createPushOperation(preview(), "normal", false)).toMatchObject({
      mode: { kind: "normal" },
    });
    expect(createPushOperation(preview({ fastForward: false }), "forceWithLease", true)).toMatchObject({
      destination: { remoteRef: "refs/heads/main", setUpstream: true },
      mode: { kind: "forceWithLease", expectedRemoteOid: OID },
    });
  });

  it("disables force without an exact verified remote oid", () => {
    const unavailable = preview({ expectedLeaseOid: null, remoteStateError: "offline" });
    expect(canForceWithLease(unavailable)).toBe(false);
    expect(() => createPushOperation(unavailable, "forceWithLease", false)).toThrow(/exact reviewed/);
  });

  it("disables normal push for divergence and confirms generic or protected force", () => {
    const diverged = preview({ fastForward: false });
    expect(canNormalPush(diverged)).toBe(false);
    expect(requiresPushConfirmation(diverged, "forceWithLease", false)).toBe(true);
    expect(requiresPushConfirmation(diverged, "forceWithLease", true)).toBe(false);
    expect(requiresPushConfirmation(preview({ protectedBranch: true }), "forceWithLease", true)).toBe(true);
  });
});
