import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProjectToolWindow } from "./ProjectToolWindow";

describe("ProjectToolWindow", () => {
  it("exposes the Rebased project toolbar in source order", () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectToolWindow, {
        activePath: "src/App.tsx",
        changes: [],
        hasCommits: true,
        loadTree: vi.fn().mockResolvedValue([]),
        onClose: vi.fn(),
        onNew: vi.fn(),
        onNewScratch: vi.fn(),
        onOpenFile: vi.fn(),
        onOpenScratch: vi.fn(),
        repositoryName: "reference",
        repositoryPath: "/private/tmp/reference",
        scratches: [],
        width: 386,
        onWidthChange: vi.fn(),
      }),
    );

    const actions = [
      "New File or Directory…",
      "Select Opened File (⌥F1, 1)",
      "Expand Selected",
      "Collapse All",
      "Options",
      "Hide",
    ];
    let previous = -1;
    for (const action of actions) {
      const index = markup.indexOf(`aria-label="${action}"`);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }

    expect(markup).toContain('aria-label="reference  /private/tmp/reference" aria-expanded="true"');
    const [selectOpenedFile] =
      markup.match(/<button[^>]*aria-label="Select Opened File \(⌥F1, 1\)"[^>]*>/) ?? [];
    expect(selectOpenedFile).toBeDefined();
    expect(selectOpenedFile).not.toContain('disabled=""');
  });

  it("disables selecting an opened file when the project has no active editor", () => {
    const markup = renderToStaticMarkup(
      createElement(ProjectToolWindow, {
        changes: [],
        hasCommits: true,
        loadTree: vi.fn().mockResolvedValue([]),
        onClose: vi.fn(),
        onNew: vi.fn(),
        onNewScratch: vi.fn(),
        onOpenFile: vi.fn(),
        onOpenScratch: vi.fn(),
        repositoryName: "dirty",
        repositoryPath: "/private/tmp/dirty",
        scratches: [],
        width: 458,
        onWidthChange: vi.fn(),
      }),
    );

    const [selectOpenedFile] =
      markup.match(/<button[^>]*aria-label="Select Opened File \(⌥F1, 1\)"[^>]*>/) ?? [];
    expect(selectOpenedFile).toBeDefined();
    expect(selectOpenedFile).toContain('disabled=""');
  });
});
