import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { sampleRefs } from "../domain/sampleData";
import { CommandProvider } from "./CommandProvider";
import { GitBranchesPopup } from "./GitBranchesPopup";

describe("GitBranchesPopup", () => {
  it("renders the Rebased search, action toolbar, and branches tree", () => {
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
          onCommit: vi.fn(),
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

    expect(markup).toContain('aria-label="Search"');
    expect(markup).toContain('placeholder="Search for branches and actions"');
    expect(markup).toContain('aria-label="Branches Tree"');
    expect(markup).toContain('role="tree"');
    expect(markup).toContain('role="treeitem"');
    expect(markup).toContain("Commit…");
    expect(markup).toContain("New Branch…");
    expect(markup).toContain("Checkout Tag or Revision…");
    expect(markup).toContain('aria-label="Fetch"');
    expect(markup).toContain('aria-label="Settings"');
    expect(markup).toContain(">Local<");
    expect(markup).toContain(">Remote<");
    expect(markup).not.toContain("New Branch from…");
  });
});
