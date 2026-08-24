import { describe, expect, it } from "vitest";
import type {
  HistoryRewritePreview,
  RebasePlanEntry,
} from "../shared/contracts/model/index";
import {
  historyPlanError,
  moveHistoryPlanEntry,
  prepareHistoryPlan,
} from "./historyRewrite";

const entry = (
  oid: string,
  overrides: Partial<RebasePlanEntry> = {},
): RebasePlanEntry => ({
  oid,
  subject: oid,
  parents: [],
  action: "pick",
  message: null,
  published: false,
  mergeCommit: false,
  ...overrides,
});

const preview = (entries: RebasePlanEntry[]): HistoryRewritePreview => ({
  branch: "main",
  headOid: entries.at(-1)?.oid ?? "",
  base: null,
  root: true,
  entries,
  publishedCommitCount: 0,
  descendantCount: entries.length,
  dependentRefs: [],
  hasMerges: false,
  protectedBranch: false,
  warnings: [],
});

describe("역사 다시 쓰기 계획", () => {
  it("[성공] 최종 메시지를 사용하여 가장 오래된 것부터 빠른 스쿼시를 준비함", () => {
    const plan = prepareHistoryPlan(
      preview([entry("a"), entry("b"), entry("c")]),
      new Set(["a", "b"]),
    );
    expect(plan.map((item) => [item.oid, item.action, item.message])).toEqual([
      ["a", "reword", "a"],
      ["b", "squash", null],
      ["c", "pick", null],
    ]);
    expect(historyPlanError(plan)).toBeNull();
  });

  it("[성공] 아이들 목표를 검증하고 수호할 수 있도록 재단함", () => {
    expect(historyPlanError([entry("a", { action: "fixup" })])).toMatch(
      /earlier picked/,
    );
    expect(
      historyPlanError([entry("m", { mergeCommit: true, action: "drop" })]),
    ).toMatch(/Merge/);
    const original = [entry("a"), entry("b"), entry("c")];
    expect(
      moveHistoryPlanEntry(original, "c", "a").map((item) => item.oid),
    ).toEqual(["c", "a", "b"]);
    expect(original.map((item) => item.oid)).toEqual(["a", "b", "c"]);
  });
});
