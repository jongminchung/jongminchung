import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_DIFF_PREFERENCES } from "../domain/changeReview";
import type { Commit } from "../domain/types";
import { CommandProvider } from "./CommandProvider";
import { CommitGraph } from "./CommitGraph";
import { CommitLog } from "./CommitLog";
import { DetailsPane } from "./DetailsPane";

const commits: readonly Commit[] = [
  {
    oid: "1111111111111111111111111111111111111111",
    parents: ["2222222222222222222222222222222222222222"],
    author: "Audit User",
    email: "audit@example.com",
    authoredAt: 1_700_000_000,
    committedAt: 1_700_000_000,
    refs: ["HEAD -> refs/heads/main"],
    subject: "Second fixture commit",
    body: "",
  },
  {
    oid: "2222222222222222222222222222222222222222",
    parents: [],
    author: "Audit User",
    email: "audit@example.com",
    authoredAt: 1_699_999_000,
    committedAt: 1_699_999_000,
    refs: [],
    subject: "Initial fixture commit",
    body: "",
  },
];

function renderHistory(): string {
  return renderToStaticMarkup(
    createElement(
      CommandProvider,
      null,
      createElement(CommitLog, {
        commits,
        selectedOids: [],
        onSelectionChange: vi.fn(),
        onContextMenu: vi.fn(),
        refs: [],
        hasMore: false,
        onLoad: vi.fn(async () => undefined),
        onImportPatch: vi.fn(),
        onRefresh: vi.fn(),
        onOpenNewTab: vi.fn(),
        onEnableIndexing: vi.fn(async () => undefined),
        indexingEnabled: true,
        indexing: false,
        onCherryPick: vi.fn(),
        canCherryPick: false,
        loading: false,
        error: null,
        ahead: 0,
        behind: 0,
        powerSaveMode: false,
        relativeTimeBaseSeconds: 1_700_000_100,
      }),
    ),
  );
}

function renderEmptyReview(): string {
  return renderToStaticMarkup(
    createElement(
      CommandProvider,
      null,
      createElement(DetailsPane, {
        files: [],
        loading: false,
        beforePreview: null,
        afterPreview: null,
        beforeContent: null,
        afterContent: null,
        submoduleDiff: null,
        selectedPath: null,
        patch: "",
        diffLoading: false,
        preferences: DEFAULT_DIFF_PREFERENCES,
        parentRevision: null,
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
        reviewWidth: 194,
        onReviewWidthChange: vi.fn(),
        onRevertSelectedChanges: vi.fn(async () => undefined),
      }),
    ),
  );
}

describe("Rebased 1.1.11 history surfaces", () => {
  it("uses the independently measured filter and commit row heights", () => {
    const markup = renderHistory();

    expect(markup).toContain('data-filter-row-height="22"');
    expect(markup).toContain('data-log-row-height="19"');
    expect(markup).toContain("grid-template-rows:22px minmax(0, 1fr) 0");
    expect(markup).toContain("height:38px;position:relative");
    expect(markup).toContain("height:19px;transform:translateY(0px)");
    expect(markup).toContain("height:19px;transform:translateY(19px)");
    expect(markup).toContain("[height:19px]!");
    expect(markup).not.toContain("[height:20px]!");
  });

  it("keeps graph geometry on the same 19 pixel row cadence", () => {
    const markup = renderToStaticMarkup(createElement(CommitGraph, { commits, width: 34 }));

    expect(markup).toContain('data-row-height="19"');
    expect(markup).toContain('height="38"');
    expect(markup).toContain("height:38px");
  });

  it("renders the measured empty review when no commit is selected", () => {
    const markup = renderEmptyReview();
    const changesLabel = markup.indexOf("Select commit to view changes");
    const detailsLabel = markup.indexOf("Commit details");

    expect(markup).toContain('data-commit-selection="empty"');
    expect(markup).toContain('data-empty-revision-review="true"');
    expect(changesLabel).toBeGreaterThan(-1);
    expect(detailsLabel).toBeGreaterThan(changesLabel);
    expect(markup).not.toContain('aria-label="Changed files"');
  });
});
