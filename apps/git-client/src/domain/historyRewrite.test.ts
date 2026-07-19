import { describe, expect, it } from "vitest";
import type { HistoryRewritePreview, RebasePlanEntry } from "../generated";
import { historyPlanError, moveHistoryPlanEntry, prepareHistoryPlan } from "./historyRewrite";

const entry = (oid: string, overrides: Partial<RebasePlanEntry> = {}): RebasePlanEntry => ({
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

describe("history rewrite plan", () => {
  it("prepares quick squash oldest-first with an editable final message", () => {
    const plan = prepareHistoryPlan(preview([entry("a"), entry("b"), entry("c")]), new Set(["a", "b"]));
    expect(plan.map((item) => [item.oid, item.action, item.message])).toEqual([
      ["a", "reword", "a"],
      ["b", "squash", null],
      ["c", "pick", null],
    ]);
    expect(historyPlanError(plan)).toBeNull();
  });

  it("validates action targets and keeps reordering immutable", () => {
    expect(historyPlanError([entry("a", { action: "fixup" })])).toMatch(/earlier picked/);
    expect(historyPlanError([entry("m", { mergeCommit: true, action: "drop" })])).toMatch(/Merge/);
    const original = [entry("a"), entry("b"), entry("c")];
    expect(moveHistoryPlanEntry(original, "c", "a").map((item) => item.oid)).toEqual(["c", "a", "b"]);
    expect(original.map((item) => item.oid)).toEqual(["a", "b", "c"]);
  });
});
