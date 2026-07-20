import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_DIFF_PREFERENCES } from "../domain/changeReview";
import { sampleCommitFiles, sampleCommits } from "../domain/sampleData";
import { CommandProvider } from "./CommandProvider";
import { DetailsPane } from "./DetailsPane";

function renderDetails(commitIndex: number | null): string {
  const commit = commitIndex === null ? undefined : sampleCommits[commitIndex];
  return renderToStaticMarkup(
    createElement(
      CommandProvider,
      null,
      createElement(DetailsPane, {
        commit,
        files: commit ? sampleCommitFiles : [],
        loading: false,
        beforePreview: null,
        afterPreview: null,
        beforeContent: null,
        afterContent: null,
        submoduleDiff: null,
        selectedPath: commit ? (sampleCommitFiles[0]?.path ?? null) : null,
        patch: "",
        diffLoading: false,
        preferences: DEFAULT_DIFF_PREFERENCES,
        parentRevision: commit?.parents[0] ?? null,
        onParentRevisionChange: vi.fn(),
        onPreferencesChange: vi.fn(),
        onSelectFile: vi.fn(),
        onLoadDiff: vi.fn(async () => ""),
        onReadFile: vi.fn(async (_source, path) => ({
          kind: "text" as const,
          path,
          content: "",
          sizeBytes: 0,
          lineCount: 0,
        })),
        onOpenTree: vi.fn(),
        onInspectFile: vi.fn(),
        onPrevious: vi.fn(),
        onNext: vi.fn(),
        onRevertSelectedChanges: vi.fn(async () => undefined),
        reviewWidth: 760,
        onReviewWidthChange: vi.fn(),
      }),
    ),
  );
}

describe("DetailsPane", () => {
  it("matches the empty Rebased revision-review split and toolbar", () => {
    const markup = renderDetails(null);

    expect(markup).toContain('aria-label="Show Diff"');
    expect(markup).toContain('aria-label="Revert Selected Changes"');
    expect(markup).toContain('aria-label="View Options"');
    expect(markup).toContain('aria-label="Expand All"');
    expect(markup).toContain('aria-label="Collapse All"');
    expect(markup).toContain("Select commit to view changes");
    expect(markup).toContain("Commit details");
  });

  it("shows changed files above commit metadata for a selected commit", () => {
    const markup = renderDetails(0);

    expect(markup).toContain('aria-label="Changed files"');
    expect(markup).toContain(sampleCommitFiles[0]?.path ?? "");
    expect(markup).toContain(sampleCommits[0]?.subject ?? "");
    expect(markup).toContain("Browse Repository");
    expect(markup).toContain("View File");
  });
});
