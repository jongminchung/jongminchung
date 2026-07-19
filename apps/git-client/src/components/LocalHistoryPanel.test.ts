import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { sampleStatus } from "../domain/sampleData";
import { CommandProvider } from "./CommandProvider";
import { LocalHistoryPanel } from "./LocalHistoryPanel";

describe("LocalHistoryPanel", () => {
  it("renders project/file history controls and restore affordance", () => {
    const markup = renderToStaticMarkup(createElement(
      CommandProvider,
      null,
      createElement(LocalHistoryPanel, {
        initialPath: "README.md",
        status: sampleStatus,
        loadHistory: vi.fn(async () => []),
        loadDiff: vi.fn(async () => ""),
        onRestore: vi.fn(async () => undefined),
        onCapture: vi.fn(async () => ({
          id: "723094e7-bf3b-4d3f-8f74-6cebe9571840",
          repositoryId: "723094e7-bf3b-4d3f-8f74-6cebe9571841",
          createdAtMs: 1,
          label: "Label",
          paths: ["README.md"],
          snapshotSha256: "a".repeat(64),
        })),
      }),
    ));

    expect(markup).toContain('aria-label="Local History"');
    expect(markup).toContain('aria-label="Local History path"');
    expect(markup).toContain("Put Label…");
    expect(markup).toContain("Revert");
    expect(markup).toContain("README.md");
  });
});
