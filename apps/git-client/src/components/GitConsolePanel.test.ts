import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { GitConsoleEntry } from "../domain/gitConsole";
import { GitConsolePanel } from "./GitConsolePanel";

const entry: GitConsoleEntry = {
  requestId: "request-1",
  repositoryId: "repository-1",
  command: "git status --porcelain=v2",
  status: "completed",
  startedAt: 10,
  completedAt: 15,
  output: "# branch.head main\n",
};

describe("GitConsolePanel", () => {
  it("renders command lifecycle controls and the recorded command", () => {
    const markup = renderToStaticMarkup(createElement(GitConsolePanel, {
      entries: [entry],
      onClear: vi.fn(),
    }));

    expect(markup).toContain('aria-label="Git Console"');
    expect(markup).toContain("git status --porcelain=v2");
    expect(markup).toContain("Expand All");
    expect(markup).toContain("Collapse All");
    expect(markup).toContain("Clear All");
  });
});
