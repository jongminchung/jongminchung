import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CommandProvider } from "./CommandProvider";
import { LocalHistoryPanel } from "./LocalHistoryPanel";

describe("LocalHistoryPanel", () => {
  it("renders project/file history controls and restore affordance", () => {
    const markup = renderToStaticMarkup(
      createElement(
        CommandProvider,
        null,
        createElement(LocalHistoryPanel, {
          initialPath: "README.md",
          repositoryId: "723094e7-bf3b-4d3f-8f74-6cebe9571841",
          repositoryName: "sample",
          mode: "project",
          loadActivities: vi.fn(async () => ({ activities: [], nextCursor: null })),
          loadActivity: vi.fn(),
          loadDiff: vi.fn(async () => ""),
          onRevert: vi.fn(async () => undefined),
          onCreatePatch: vi.fn(async () => ""),
          onPutLabel: vi.fn(),
        }),
      ),
    );

    expect(markup).toContain('aria-label="Local History"');
    expect(markup).toContain('aria-label="Search by file name"');
    expect(markup).toContain('aria-label="Activity History"');
    expect(markup).toContain("No activity in sample detected");
    expect(markup).toContain("Revert Selected and Later Changes");
    expect(markup).toContain("Select activity to view changes");
  });
});
