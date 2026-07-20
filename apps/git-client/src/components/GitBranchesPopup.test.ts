import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { sampleRefs } from "../domain/sampleData";
import { CommandProvider } from "./CommandProvider";
import { GitBranchesPopup } from "./GitBranchesPopup";

describe("GitBranchesPopup", () => {
    it("keeps branch actions and grouped refs in the popup surface", () => {
        const markup = renderToStaticMarkup(
            createElement(
                CommandProvider,
                null,
                createElement(GitBranchesPopup, {
                    refs: sampleRefs,
                    currentBranch: "main",
                    onCheckout: vi.fn(() => Promise.resolve()),
                    onOperation: vi.fn(() => Promise.resolve()),
                    onCompare: vi.fn(() =>
                        Promise.resolve({
                            ahead: 1,
                            behind: 2,
                            leftOnly: [],
                            rightOnly: [],
                        }),
                    ),
                    onOpenSettings: vi.fn(),
                    onClose: vi.fn(),
                    remotes: [
                        {
                            name: "origin",
                            fetchUrl: "git@example.test/repo.git",
                            pushUrl: "git@example.test/repo.git",
                        },
                    ],
                }),
            ),
        );

        expect(markup).toContain('aria-label="Git Branches"');
        expect(markup).toContain('aria-label="Search branches"');
        expect(markup).toContain("New Branch…");
        expect(markup).toContain("Checkout Tag or Revision…");
        expect(markup).toContain('aria-label="Local"');
        expect(markup).toContain('aria-label="Remote"');
        expect(markup).toContain('aria-label="Tags"');
        expect(markup).toContain("Current");
        expect(markup).toContain("New Branch from…");
        expect(markup).toContain("Rename…");
        expect(markup).toContain("Delete…");
        expect(markup).toContain("Set Upstream…");
        expect(markup).toContain("New Tag…");
        expect(markup).toContain("New Worktree…");
    });
});
