import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  changeEntries,
  DEFAULT_DIFF_PREFERENCES,
  EMPTY_COMMIT_DRAFT,
} from "../domain/changeReview";
import { sampleStatus } from "../domain/sampleData";
import { ChangesWorkspace } from "./ChangesWorkspace";
import { CommandProvider } from "./CommandProvider";

describe("ChangesWorkspace", () => {
  it("renders the Rebased vertical Commit tool-window structure", () => {
    const entries = changeEntries(sampleStatus);
    const markup = renderToStaticMarkup(
      createElement(
        CommandProvider,
        null,
        createElement(ChangesWorkspace, {
          toolWindow: true,
          status: sampleStatus,
          entries,
          selection: entries[0]?.selection ?? null,
          patch: "",
          diffLoading: false,
          beforePreview: null,
          afterPreview: null,
          beforeContent: null,
          afterContent: null,
          submoduleDiff: null,
          navigatorWidth: 250,
          commitRailWidth: 315,
          preferences: DEFAULT_DIFF_PREFERENCES,
          draft: EMPTY_COMMIT_DRAFT,
          changelists: [],
          onSelectionChange: vi.fn(),
          onPreferencesChange: vi.fn(),
          onDraftChange: vi.fn(),
          onOperation: vi.fn(async () => undefined),
          onCommitOperation: vi.fn(async () => undefined),
          onPreCommitCheck: vi.fn(async () => ({
            branch: "main",
            detachedHead: false,
            protectedBranch: false,
            crlfPaths: [],
            largeFiles: [],
            riskyPaths: [],
            hooks: [],
          })),
          onCommitChangelist: vi.fn(async () => undefined),
          onSaveChangelist: vi.fn(async () => ({
            id: "list-1",
            repositoryId: "repository-1",
            name: "Feature",
            paths: [],
            createdAtMs: 0,
            updatedAtMs: 0,
          })),
          onDeleteChangelist: vi.fn(async () => undefined),
          onInspectFile: vi.fn(),
          onOpenExternally: vi.fn(async () => undefined),
          onOpenConflict: vi.fn(),
          onNavigatorWidthChange: vi.fn(),
          onCommitRailWidthChange: vi.fn(),
          onOpenPush: vi.fn(),
          onCloseToolWindow: vi.fn(),
        }),
      ),
    );

    expect(markup).toContain("changesToolWindow");
    expect(markup).toContain('aria-label="Close Commit"');
    expect(markup).toContain("Staged");
    expect(markup).toContain("Working Tree");
    expect(markup).toContain("Commit Message");
    expect(markup).toContain("Commit &amp; Push");
  });
});
