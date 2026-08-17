import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_DIFF_PREFERENCES } from "../domain/changeReview";
import { CommandProvider } from "./CommandProvider";
import { DetailsPane } from "./DetailsPane";

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
                reviewWidth: 253,
                onReviewWidthChange: vi.fn(),
                onRevertSelectedChanges: vi.fn(async () => undefined),
            }),
        ),
    );
}

describe("Rebased 1.1.11 history surfaces", () => {
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
