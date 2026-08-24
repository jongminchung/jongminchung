import { describe, expect, it } from "vitest";
import type { PushPreview } from "../shared/contracts/model/index";
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

describe("밀어넣기", () => {
  it("[실패] 부울 반환 없이 일반 및 임시 작업을 생성함", () => {
    expect(createPushOperation(preview(), "normal", false)).toMatchObject({
      mode: { kind: "normal" },
    });
    expect(
      createPushOperation(
        preview({ fastForward: false }),
        "forceWithLease",
        true,
      ),
    ).toMatchObject({
      destination: { remoteRef: "refs/heads/main", setUpstream: true },
      mode: { kind: "forceWithLease", expectedRemoteOid: OID },
    });
  });

  it("[실패] 자격증 인증된 원격 oid 없이 인증을 받으려면", () => {
    const unavailable = preview({
      expectedLeaseOid: null,
      remoteStateError: "offline",
    });
    expect(canForceWithLease(unavailable)).toBe(false);
    expect(() =>
      createPushOperation(unavailable, "forceWithLease", false),
    ).toThrow(/exact reviewed/);
  });

  it("[성공] 발산을 초대하여 초대하고 일반 또는 보호된 힘을 확인함", () => {
    const diverged = preview({ fastForward: false });
    expect(canNormalPush(diverged)).toBe(false);
    expect(requiresPushConfirmation(diverged, "forceWithLease", false)).toBe(
      true,
    );
    expect(requiresPushConfirmation(diverged, "forceWithLease", true)).toBe(
      false,
    );
    expect(
      requiresPushConfirmation(
        preview({ protectedBranch: true }),
        "forceWithLease",
        true,
      ),
    ).toBe(true);
  });
});
