import { createElement } from "react";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UNAVAILABLE_TERMINAL } from "../application/terminal/ports/TerminalAvailability";
import { sampleStatus } from "../domain/sampleData";
import type { StashEntry } from "../domain/types";
import { BottomPanel } from "./BottomPanel";
import { CommandProvider } from "./CommandProvider";

const stash: StashEntry = {
  selector: "stash@{0}",
  oid: "1234567890abcdef",
  subject: "On main: focused stash flow",
  author: "Developer",
  email: "developer@example.com",
  createdAt: 1_700_000_000,
  files: [],
};

const props = {
  status: sampleStatus,
  shelves: [],
  stashes: [stash],
  recoveryEntries: [],
  gitConsoleEntries: [],
  onOperation: vi.fn(async () => undefined),
  onCreateShelf: vi.fn(),
  onApplyShelf: vi.fn(),
  onDeleteShelf: vi.fn(),
  onRestoreRecovery: vi.fn(async () => undefined),
  onClearGitConsole: vi.fn(),
  onLoadLocalHistoryActivities: vi.fn(async () => ({
    activities: [],
    nextCursor: null,
  })),
  onLoadLocalHistoryActivity: vi.fn(async () => {
    throw new Error("not expected");
  }),
  onLoadLocalHistoryDiff: vi.fn(async () => ""),
  onRevertLocalHistory: vi.fn(async () => undefined),
  onCreateLocalHistoryPatch: vi.fn(async () => ""),
  onPutLocalHistoryLabel: vi.fn(async () => {
    throw new Error("not expected");
  }),
  findResults: null,
  onOpenFindResult: vi.fn(),
  onSearchAgain: vi.fn(),
  onOpenStashDiff: vi.fn(),
  onLoadStashFiles: vi.fn(async () => []),
  repositoryId: "repository-1",
  repositoryName: "fixture",
  terminalAvailability: UNAVAILABLE_TERMINAL,
  collapsed: false,
  onToggle: vi.fn(),
  height: 260,
  onHeightChange: vi.fn(),
  active: "stash",
  onActiveChange: vi.fn(),
} satisfies ComponentProps<typeof BottomPanel>;

describe("BottomPanel 숨김", () => {
  it("[성공] 결의적 생성, 적용, 팝 및 드롭 보존점을 연합함", () => {
    const markup = renderToStaticMarkup(
      createElement(CommandProvider, null, createElement(BottomPanel, props)),
    );

    expect(markup).toContain("Stash Changes…");
    expect(markup).toContain("Apply");
    expect(markup).toContain("Pop");
    expect(markup).toContain("Drop");
    expect(markup).toContain("stash@{0}: On main: focused stash flow");
  });

  it("[성공] 패널이 작아지는 동안 도구 창 노래를 숨기기", () => {
    const markup = renderToStaticMarkup(
      createElement(
        CommandProvider,
        null,
        createElement(BottomPanel, {
          ...props,
          collapsed: true,
        }),
      ),
    );

    expect(markup).toContain("bottomCollapsed");
    expect(markup).not.toContain('aria-label="Stash Tool Window Tab"');
    expect(markup).not.toContain('role="tabpanel"');
  });
});
