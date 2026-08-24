import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  setWorkbenchEventPort,
  type WorkbenchEventPort,
} from "../../../application/workbench-events/WorkbenchEventPort";
import {
  DEFAULT_BOOKMARK_VIEW_OPTIONS,
  type ProjectBookmarks,
} from "../../../domain/bookmarks";
import {
  COMMAND_ENABLED,
  COMMAND_MANIFEST,
  type CommandDefinition,
} from "../../../domain/commands";
import { sampleRepository } from "../../../domain/sampleData";
import {
  createAppearanceLayoutCommands,
  type AppearanceLayoutCommandPort,
} from "./appearanceLayoutCommands";
import {
  createEditorNavigationCommands,
  type EditorNavigationCommandPort,
} from "./editorNavigationCommands";
import {
  createProjectCommands,
  type ProjectCommandPort,
} from "./projectCommands";
import {
  createSearchAnalysisCommands,
  type SearchAnalysisCommandPort,
} from "./searchAnalysisCommands";
import { createVcsCommands, type VcsCommandPort } from "./vcsCommands";

const fallback = new Proxy(vi.fn(), {
  get: () => fallback,
});

function fakePort<Port extends object>(overrides: Partial<Port> = {}): Port {
  return new Proxy(overrides, {
    get: (target, key) =>
      Reflect.has(target, key) ? Reflect.get(target, key) : fallback,
  }) as Port;
}

function command(
  definitions: readonly CommandDefinition[],
  id: string,
): CommandDefinition {
  const result = definitions.find((definition) => definition.id === id);
  if (!result) throw new Error(`Missing command ${id}`);
  return result;
}

const emptyBookmarks: ProjectBookmarks = {
  schemaVersion: 1,
  view: DEFAULT_BOOKMARK_VIEW_OPTIONS,
  groups: [],
};

function repositoryCommandDefinitions(): readonly CommandDefinition[] {
  const dialog = fakePort<ProjectCommandPort["dialog"]>({
    confirm: vi.fn(async () => false),
    input: vi.fn(async () => null),
  });
  const session = fallback as unknown as ProjectCommandPort["session"];
  const repositoryAvailability = () => COMMAND_ENABLED;
  const editorActionAvailability = () => COMMAND_ENABLED;

  return [
    ...createProjectCommands(
      fakePort<ProjectCommandPort>({
        dialog,
        dirtyInspectorKeys: new Set(),
        inspector: undefined,
        projectFiles: [],
        repositoryAvailability,
        session,
      }),
    ),
    ...createEditorNavigationCommands(
      fakePort<EditorNavigationCommandPort>({
        activeInspectorIndex: -1,
        activeInspectorKey: undefined,
        activeToolWindow: null,
        bookmarks: emptyBookmarks,
        bottomPanelTab: "terminal",
        dirtyInspectorKeys: new Set(),
        dispatchEditorAction: vi.fn(() => true),
        dispatchEditorSearch: vi.fn(() => true),
        editorActionAvailability,
        editorStatus: undefined,
        editorTabAvailability: repositoryAvailability,
        inspector: undefined,
        inspectorTabKeys: [],
        pinnedInspectorKeys: new Set(),
        previewInspectorKey: undefined,
        readOnlyInspectorKeys: [],
        requestCloseInspector: vi.fn(async () => undefined),
        requestCloseInspectors: vi.fn(async () => undefined),
        terminalTabCount: 0,
      }),
    ),
    ...createVcsCommands(
      fakePort<VcsCommandPort>({
        availability: fallback as unknown as VcsCommandPort["availability"],
        changeSelection: null,
        conflictedFile: undefined,
        dialog,
        hasTrackedWorkingChanges: false,
        historySelectedPath: null,
        inspector: undefined,
        primaryCommit: undefined,
        repository: sampleRepository,
        repositoryAvailability,
        session: session as VcsCommandPort["session"],
        untrackedPaths: [],
        vcsFileChange: null,
        vcsFileEntry: null,
        vcsFilePath: null,
        vcsFileVersioned: false,
        workingEntries: [],
      }),
    ),
    ...createSearchAnalysisCommands(
      fakePort<SearchAnalysisCommandPort>({
        dispatchEditorSearch: vi.fn(() => true),
        editorActionAvailability,
        editorStatus: undefined,
        inspector: undefined,
        navigationHistory: { current: [] },
        navigationIndex: -1,
      }),
    ),
    ...createAppearanceLayoutCommands(
      fakePort<AppearanceLayoutCommandPort>({
        activeToolWindow: null,
        balloonId: undefined,
        bookmarksOpen: false,
        bottomPanelTab: "terminal",
        logOpen: false,
        logTabIds: [],
        notificationOpen: false,
        notifications: [],
        processesOpen: false,
        projectOpen: false,
        repositoryAvailability,
        repositoryViewMode: "history",
        terminalTabCount: 0,
      }),
    ),
  ];
}

describe("사용자는 다음과 같은 기능을 가지고 있음", () => {
  let uninstallWorkbenchEvents: () => void;

  beforeEach(() => {
    class TestHTMLElement {}
    const target = new EventTarget() as Window & typeof globalThis;
    Object.assign(target, {
      location: new URL("https://example.invalid/"),
      getSelection: () => null,
      open: vi.fn(),
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      },
    });
    vi.stubGlobal("document", {
      activeElement: null,
      execCommand: vi.fn(),
      querySelector: vi.fn(() => null),
    });
    vi.stubGlobal("HTMLElement", TestHTMLElement);
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn(async () => undefined) },
    });
    vi.stubGlobal("window", target);
    const testEvents: WorkbenchEventPort = {
      dispatch: (name, detail, options = {}) =>
        target.dispatchEvent(
          new CustomEvent(name, {
            cancelable: options.cancelable,
            detail,
          }),
        ),
      listen: (name, listener) => {
        const handle = (event: Event): void =>
          listener((event as CustomEvent).detail, {
            preventDefault: () => event.preventDefault(),
          });
        target.addEventListener(name, handle);
        return () => target.removeEventListener(name, handle);
      },
    };
    uninstallWorkbenchEvents = setWorkbenchEventPort(testEvents);
  });

  afterEach(() => {
    uninstallWorkbenchEvents();
    vi.unstubAllGlobals();
  });

  it("[성공] 기아 매니페스트의 모든 패키지토리 수수께끼를 해결함", () => {
    const definitions = repositoryCommandDefinitions();
    const manifestIds = new Set(
      COMMAND_MANIFEST.commands.map((entry) => entry.id),
    );

    expect(definitions.every(({ id }) => manifestIds.has(id))).toBe(true);
    expect(new Set(definitions.map(({ id }) => id)).size).toBe(
      definitions.length,
    );
  });

  it("[성공] 모든 압축기에 대한 가용성 및 확인된 상태를 평가함", () => {
    for (const definition of repositoryCommandDefinitions()) {
      expect(
        ["enabled", "disabled"],
        `${definition.id} availability`,
      ).toContain(definition.availability().status);
      if (definition.checked) {
        expect(
          typeof definition.checked(),
          `${definition.id} checked state`,
        ).toBe("boolean");
      }
    }
  });

  it("[성공] 좁은 쉬크 포트에 대해 모든 범위를 실행함", async () => {
    for (const definition of repositoryCommandDefinitions()) {
      try {
        await definition.execute();
      } catch (error) {
        throw new Error(`Command ${definition.id} failed`, {
          cause: error,
        });
      }
    }
  });

  it("[성공] 해당 기능을 사용할 수 있는 업체를 대표함", async () => {
    const openScratch = vi.fn();
    const focusSearch = vi.fn();
    const collapseBottom = vi.fn();
    const observed: string[] = [];
    window.addEventListener("git-client:save-all", () => observed.push("save"));
    window.addEventListener("git-client:open-local-history", () =>
      observed.push("history"),
    );
    window.addEventListener("git-client:open-git-console", () =>
      observed.push("console"),
    );

    await command(
      createProjectCommands(
        fakePort<ProjectCommandPort>({
          setScratchFileChooserOpen: openScratch,
        }),
      ),
      "workspace.newScratch",
    ).execute();
    await command(
      createEditorNavigationCommands(fakePort<EditorNavigationCommandPort>()),
      "workspace.saveAll",
    ).execute();
    await command(
      createVcsCommands(fakePort<VcsCommandPort>()),
      "localHistory.recent",
    ).execute();
    await command(
      createSearchAnalysisCommands(
        fakePort<SearchAnalysisCommandPort>({
          focusCurrentSearch: focusSearch,
        }),
      ),
      "view.search",
    ).execute();
    await command(
      createAppearanceLayoutCommands(
        fakePort<AppearanceLayoutCommandPort>({
          logTabIds: [],
          notifications: [],
          setBottomCollapsed: collapseBottom,
        }),
      ),
      "view.gitConsole",
    ).execute();

    expect(openScratch).toHaveBeenCalledWith(true);
    expect(focusSearch).toHaveBeenCalledOnce();
    expect(collapseBottom).toHaveBeenCalledWith(false);
    expect(observed).toEqual(["save", "history", "console"]);
  });
});
