import { describe, expect, it } from "vitest";
import type { FileChange, StatusModel } from "./types";
import {
  DEFAULT_DIFF_PREFERENCES,
  changeEntries,
  parseChangeSelection,
  parseCommitDraft,
  parseDiffPreferences,
  parseRepositoryViewMode,
  reconcileChangeSelection,
  revisionDiffEntries,
} from "./changeReview";

const file = (overrides: Partial<FileChange>): FileChange => ({
  path: "src/app.ts",
  status: "modified",
  staged: false,
  worktree: true,
  ...overrides,
});

const status = (changes: readonly FileChange[]): StatusModel => ({
  ahead: 0,
  behind: 0,
  stashCount: 0,
  changes,
});

describe("change review state", () => {
  it("creates separate index and worktree selections for partially staged files", () => {
    expect(changeEntries(status([file({ staged: true })]))).toMatchObject([
      { selection: { path: "src/app.ts", layer: "index" } },
      { selection: { path: "src/app.ts", layer: "worktree" } },
    ]);
  });

  it("restores the opposite layer before selecting a neighboring file", () => {
    const entries = changeEntries(
      status([
        file({ staged: true, worktree: false }),
        file({ path: "src/next.ts" }),
      ]),
    );
    expect(
      reconcileChangeSelection({ path: "src/app.ts", layer: "worktree" }, entries),
    ).toEqual({ path: "src/app.ts", layer: "index" });
  });

  it("selects the first entry initially and clears an empty repository", () => {
    const entries = changeEntries(status([file({})]));
    expect(reconcileChangeSelection(null, entries)).toEqual({
      path: "src/app.ts",
      layer: "worktree",
    });
    expect(reconcileChangeSelection(entries[0]?.selection ?? null, [])).toBeNull();
  });

  it("validates persisted view, selection, preferences, and draft values", () => {
    expect(parseRepositoryViewMode("changes")).toBe("changes");
    expect(parseRepositoryViewMode("unknown")).toBe("history");
    expect(parseChangeSelection({ path: "a.ts", layer: "index" })).toEqual({
      path: "a.ts",
      layer: "index",
    });
    expect(parseChangeSelection({ path: "a.ts", layer: "bad" })).toBeNull();
    expect(parseDiffPreferences(null)).toEqual(DEFAULT_DIFF_PREFERENCES);
    expect(
      parseDiffPreferences({
        viewMode: "unified",
        whitespace: "ignoreAll",
        contextLines: "full",
        wordWrap: true,
        collapseUnchanged: false,
        synchronizedScroll: false,
      }),
    ).toEqual({
      viewMode: "unified",
      whitespace: "ignoreAll",
      contextLines: "full",
      wordWrap: true,
      collapseUnchanged: false,
      synchronizedScroll: false,
    });
    expect(parseCommitDraft({ message: "Draft", runHooks: false })).toMatchObject({
      message: "Draft",
      runHooks: false,
      changelistId: null,
    });
  });

  it("splits revision comparisons into navigable text, binary, and submodule files", () => {
    const entries = revisionDiffEntries([
      "diff --git a/src/app.ts b/src/app.ts",
      "index 1111111..2222222 100644",
      "--- a/src/app.ts",
      "+++ b/src/app.ts",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      "diff --git a/assets/logo.png b/assets/logo.png",
      "new file mode 100644",
      "GIT binary patch",
      "diff --git a/vendor/library b/vendor/library",
      "index 3333333..4444444 160000",
      "--- a/vendor/library",
      "+++ b/vendor/library",
    ].join("\n"));
    expect(entries.map((entry) => entry.file.path)).toEqual([
      "src/app.ts",
      "assets/logo.png",
      "vendor/library",
    ]);
    expect(entries[1]?.file).toMatchObject({ status: "added", binary: true });
    expect(entries[2]?.file.submodule).toBe(true);
  });
});
