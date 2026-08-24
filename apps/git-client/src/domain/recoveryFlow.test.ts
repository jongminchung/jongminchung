import { describe, expect, it } from "vitest";
import type { HistoryRewritePreview } from "../shared/contracts/model/index";
import {
  abortOperationConfirmation,
  operationDisplayName,
  protectedRewriteConfirmation,
} from "./recoveryFlow";

describe("치료방법", () => {
  it("[실패] 일관되게 Cherry-Pick의 이름을 대표하고 중단된 복원을 설명함", () => {
    expect(operationDisplayName("cherryPick")).toBe("cherry-pick");
    expect(abortOperationConfirmation("rebase", true)).toMatchObject({
      title: "Abort rebase?",
      confirmLabel: "Abort operation",
      dangerous: true,
      impact: expect.stringContaining("discarded"),
    });
  });

  it("[성공] 실행 전 보호 기록에 다시 영향을 요약함", () => {
    const preview = {
      branch: "main",
      descendantCount: 3,
      publishedCommitCount: 2,
    } as HistoryRewritePreview;

    expect(protectedRewriteConfirmation(preview)).toMatchObject({
      title: "Rewrite protected branch main?",
      confirmLabel: "Start rebase",
      impact: expect.stringContaining("2 published commit(s)"),
    });
  });
});
