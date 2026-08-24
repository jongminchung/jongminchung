import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { sampleSnapshot } from "../domain/sampleData";
import { CommandProvider } from "./CommandProvider";
import { ProjectSwitcherPopup } from "./ProjectSwitcherPopup";

describe("프로젝트위처팝업", () => {
  it("[성공] 직접 작업에서 시작하고 키보드로 액세스할 수 있는 최신 프로젝트를 옆에 있음", () => {
    const markup = renderToStaticMarkup(
      createElement(
        CommandProvider,
        null,
        createElement(ProjectSwitcherPopup, {
          activeRepositoryId: sampleSnapshot.id,
          onActivate: vi.fn(() => Promise.resolve()),
          onClone: vi.fn(),
          onClose: vi.fn(),
          onOpen: vi.fn(),
          onOpenRecent: vi.fn(() => Promise.resolve()),
          onRemoveRecent: vi.fn(),
          openRepositories: [sampleSnapshot],
          recentProjects: [
            {
              branch: "topic",
              lastOpenedAt: 1,
              name: "recent-project",
              path: "/tmp/recent-project",
            },
          ],
        }),
      ),
    );

    expect(markup).toContain('aria-label="Projects"');
    expect(markup).not.toContain('autofocus=""');
    expect(markup).toContain(">Open…<");
    expect(markup).toContain('aria-keyshortcuts="Enter Delete Backspace"');
    expect(markup).toContain("/tmp/recent-project");
    expect(markup.indexOf(">Open…<")).toBeLessThan(
      markup.indexOf("Open Projects"),
    );
  });
});
