import { writeClipboardText } from "../../../application/desktop/DesktopPort";
import { dispatchWorkbenchEvent } from "../../../application/workbench-events/WorkbenchEventPort";
import { allLineBookmarks, relativeBookmark } from "../../../domain/bookmarks";
import {
  COMMAND_ENABLED,
  commandDefinition,
  commandDisabled,
  type CommandDefinition,
} from "../../../domain/commands";
import { inspectorKey } from "../state/workspaceTypes";
export interface EditorNavigationCommandPort {
  readonly activateRelativeInspector: (offset: -1 | 1) => void;
  readonly activeInspectorIndex: number;
  readonly activeInspectorKey: string | undefined;
  readonly activeToolWindow:
    | import("../state/workspaceTypes").RepositoryToolWindow
    | null;
  readonly beginMnemonicBookmark: () => void;
  readonly bookmarks: import("../../../domain/bookmarks").ProjectBookmarks;
  readonly bottomPanelTab: import("../../../domain/workspacePersistence").WorkspaceBottomPanelTab;
  readonly dirtyInspectorKeys: ReadonlySet<string>;
  readonly dispatchEditorAction: (
    action: import("../../../components/codeMirrorSearch").EditorAction,
  ) => boolean;
  readonly dispatchEditorSearch: (
    action: import("../../../components/codeMirrorSearch").EditorSearchAction,
  ) => boolean;
  readonly editorActionAvailability: (
    requiresEditable: boolean,
  ) => ReturnType<CommandDefinition["availability"]>;
  readonly editorStatus:
    | import("../state/workspaceTypes").EditorStatus
    | undefined;
  readonly editorTabAvailability: () => ReturnType<
    CommandDefinition["availability"]
  >;
  readonly inspector:
    | import("../state/workspaceTypes").InspectorState
    | undefined;
  readonly inspectorTabKeys: string[];
  readonly openLineBookmark: (
    bookmark: import("../../../domain/bookmarks").LineBookmark,
  ) => void;
  readonly pinnedInspectorKeys: ReadonlySet<string>;
  readonly previewInspectorKey: string | undefined;
  readonly productSettings: import("../../../domain/productSettings").ProductSettings;
  readonly readOnlyInspectorKeys: string[];
  readonly requestCloseInspector: (key: string) => Promise<void>;
  readonly requestCloseInspectors: (keys: readonly string[]) => Promise<void>;
  readonly setBookmarksPopupMode: (
    value: import("react").SetStateAction<
      | import("../../../components/BookmarksPopup").BookmarksPopupMode
      | undefined
    >,
  ) => void;
  readonly setPreviewInspectorKey: (
    value: import("react").SetStateAction<string | undefined>,
  ) => void;
  readonly setProjectSearchInitialQuery: (
    value: import("react").SetStateAction<string>,
  ) => void;
  readonly setProjectSearchSurface: (
    value: import("react").SetStateAction<
      | import("../../../components/ProjectSearchDialog").ProjectSearchSurface
      | undefined
    >,
  ) => void;
  readonly setRecentFindUsagesOpen: (
    value: import("react").SetStateAction<boolean>,
  ) => void;
  readonly setReplaceInFilesOpen: (
    value: import("react").SetStateAction<boolean>,
  ) => void;
  readonly terminalTabCount: number;
  readonly toggleCurrentBookmark: () => void;
}

export function createEditorNavigationCommands(
  context: EditorNavigationCommandPort,
): readonly CommandDefinition[] {
  const {
    activateRelativeInspector,
    activeInspectorIndex,
    activeInspectorKey,
    activeToolWindow,
    beginMnemonicBookmark,
    bookmarks,
    bottomPanelTab,
    dirtyInspectorKeys,
    dispatchEditorAction,
    dispatchEditorSearch,
    editorActionAvailability,
    editorStatus,
    editorTabAvailability,
    inspector,
    inspectorTabKeys,
    openLineBookmark,
    pinnedInspectorKeys,
    previewInspectorKey,
    productSettings,
    readOnlyInspectorKeys,
    requestCloseInspector,
    requestCloseInspectors,
    setBookmarksPopupMode,
    setPreviewInspectorKey,
    setProjectSearchInitialQuery,
    setProjectSearchSurface,
    setRecentFindUsagesOpen,
    setReplaceInFilesOpen,
    terminalTabCount,
    toggleCurrentBookmark,
  } = context;
  return [
    commandDefinition(
      "edit.replace",
      () => {
        dispatchEditorSearch("replace");
      },
      () => {
        const activeEditor =
          document.activeElement instanceof HTMLElement
            ? document.activeElement.closest<HTMLElement>(".cm-editor")
            : null;
        const editable =
          activeEditor?.querySelector<HTMLElement>(".cm-content")
            ?.contentEditable === "true";
        return editable
          ? COMMAND_ENABLED
          : commandDisabled(
              "Place the caret in an editable file editor to replace text.",
            );
      },
    ),
    commandDefinition(
      "edit.undo",
      () => {
        if (!dispatchEditorAction("undo")) document.execCommand("undo");
      },
      () =>
        document.activeElement instanceof HTMLElement &&
        (document.activeElement.closest(".cm-editor") !== null ||
          document.activeElement.matches(
            "input, textarea, [contenteditable=true]",
          ))
          ? COMMAND_ENABLED
          : commandDisabled("Focus an editable control first."),
    ),
    commandDefinition(
      "edit.redo",
      () => {
        if (!dispatchEditorAction("redo")) document.execCommand("redo");
      },
      () =>
        document.activeElement instanceof HTMLElement &&
        (document.activeElement.closest(".cm-editor") !== null ||
          document.activeElement.matches(
            "input, textarea, [contenteditable=true]",
          ))
          ? COMMAND_ENABLED
          : commandDisabled("Focus an editable control first."),
    ),
    commandDefinition(
      "edit.copyPlainText",
      async () => {
        const selection =
          window.getSelection()?.toString() || editorStatus?.selectedText || "";
        if (selection) await writeClipboardText(selection);
      },
      () =>
        window.getSelection()?.toString() || editorStatus?.selectedText
          ? COMMAND_ENABLED
          : commandDisabled("Select text in a file editor first."),
    ),
    ...(
      [
        ["edit.selectAllOccurrences", "selectAllOccurrences", false],
        ["edit.selectNextOccurrence", "selectNextOccurrence", false],
        ["edit.unselectOccurrence", "unselectOccurrence", false],
        ["edit.addCaretsToLineEnds", "addCaretsToLineEnds", false],
        ["edit.extendSelection", "extendSelection", false],
        ["edit.shrinkSelection", "shrinkSelection", false],
        ["edit.toggleCase", "toggleCase", true],
        ["edit.joinLines", "joinLines", true],
        ["edit.duplicate", "duplicate", true],
        ["edit.fillParagraph", "fillParagraph", true],
        ["edit.sortLines", "sortLines", true],
        ["edit.reverseLines", "reverseLines", true],
        ["edit.transpose", "transpose", true],
        ["edit.indentSelection", "indent", true],
        ["edit.unindentSelection", "unindent", true],
        ["edit.convertIndentsToSpaces", "convertIndentsToSpaces", true],
        ["edit.convertIndentsToTabs", "convertIndentsToTabs", true],
        ["code.expandFold", "expandFold", false],
        ["code.expandFoldRecursively", "expandFold", false],
        ["code.expandAllFolds", "expandAllFolds", false],
        ["code.collapseFold", "collapseFold", false],
        ["code.collapseFoldRecursively", "collapseFold", false],
        ["code.collapseAllFolds", "collapseAllFolds", false],
        ["code.toggleFold", "toggleFold", false],
        ["code.foldSelection", "collapseFold", false],
        ["code.foldBlock", "collapseFold", false],
        ["code.lineComment", "lineComment", true],
        ["code.blockComment", "blockComment", true],
        ["code.moveStatementDown", "moveStatementDown", true],
        ["code.moveStatementUp", "moveStatementUp", true],
        ["code.moveLineDown", "moveLineDown", true],
        ["code.moveLineUp", "moveLineUp", true],
        ["navigate.nextMethod", "nextMethod", false],
        ["navigate.previousMethod", "previousMethod", false],
        ["navigate.matchingBrace", "matchingBrace", false],
      ] as const
    ).map(([id, action, requiresEditable]) =>
      commandDefinition(
        id,
        () => {
          dispatchEditorAction(action);
        },
        () => editorActionAvailability(requiresEditable),
      ),
    ),
    commandDefinition("view.replaceInFiles", () => setReplaceInFilesOpen(true)),
    commandDefinition("edit.recentFindUsages", () =>
      setRecentFindUsagesOpen(true),
    ),
    commandDefinition(
      "edit.showUsages",
      () => {
        setProjectSearchInitialQuery(editorStatus?.symbol ?? "");
        setProjectSearchSurface("usages");
      },
      () => editorActionAvailability(false),
    ),
    commandDefinition(
      "edit.highlightUsages",
      () => {
        dispatchEditorSearch("nextWord");
      },
      () => editorActionAvailability(false),
    ),
    commandDefinition(
      "edit.nextHighlightedUsage",
      () => {
        dispatchEditorSearch("next");
      },
      () => editorActionAvailability(false),
    ),
    commandDefinition(
      "edit.previousHighlightedUsage",
      () => {
        dispatchEditorSearch("previous");
      },
      () => editorActionAvailability(false),
    ),
    commandDefinition("view.quickDefinition", () => {
      setProjectSearchInitialQuery(editorStatus?.symbol ?? "");
      setProjectSearchSurface("definition");
    }),
    commandDefinition("view.quickTypeDefinition", () => {
      setProjectSearchInitialQuery(editorStatus?.symbol ?? "");
      setProjectSearchSurface("typeDefinition");
    }),
    commandDefinition("bookmarks.toggle", toggleCurrentBookmark, () =>
      editorStatus
        ? COMMAND_ENABLED
        : commandDisabled(
            "Place the caret in a file editor to toggle a bookmark.",
          ),
    ),
    commandDefinition("bookmarks.toggleMnemonic", beginMnemonicBookmark, () =>
      editorStatus
        ? COMMAND_ENABLED
        : commandDisabled(
            "Place the caret in a file editor to assign a mnemonic.",
          ),
    ),
    commandDefinition(
      "bookmarks.previous",
      () => {
        const bookmark = relativeBookmark(bookmarks, editorStatus ?? null, -1);
        if (bookmark) openLineBookmark(bookmark);
      },
      () =>
        allLineBookmarks(bookmarks).length > 0
          ? COMMAND_ENABLED
          : commandDisabled("There are no line bookmarks."),
    ),
    commandDefinition(
      "bookmarks.next",
      () => {
        const bookmark = relativeBookmark(bookmarks, editorStatus ?? null, 1);
        if (bookmark) openLineBookmark(bookmark);
      },
      () =>
        allLineBookmarks(bookmarks).length > 0
          ? COMMAND_ENABLED
          : commandDisabled("There are no line bookmarks."),
    ),
    commandDefinition("bookmarks.show", () => setBookmarksPopupMode("lines")),
    commandDefinition(
      "bookmarks.showMnemonics",
      () => setBookmarksPopupMode("mnemonics"),
      () =>
        allLineBookmarks(bookmarks).some(
          (bookmark) => bookmark.mnemonic !== null,
        )
          ? COMMAND_ENABLED
          : commandDisabled("No bookmark mnemonic has been assigned."),
    ),
    commandDefinition(
      "navigate.jumpNavigationBar",
      () => {
        document
          .querySelector<HTMLElement>('[aria-label="Navigation Bar"] button')
          ?.focus();
      },
      () =>
        productSettings.navigationBar === "top" ||
        (productSettings.navigationBar === "status" &&
          productSettings.statusBarVisible)
          ? COMMAND_ENABLED
          : commandDisabled("The Navigation Bar is hidden."),
    ),
    commandDefinition("workspace.saveAll", () => {
      dispatchWorkbenchEvent("git-client:save-all", undefined);
    }),
    commandDefinition(
      "view.closeEditor",
      () =>
        inspector ? requestCloseInspector(inspectorKey(inspector)) : undefined,
      editorTabAvailability,
    ),
    commandDefinition(
      "view.nextEditorTab",
      () => {
        if (activeToolWindow === "bottom" && bottomPanelTab === "terminal") {
          dispatchWorkbenchEvent("git-client:terminal-tab-navigate", {
            offset: 1,
          });
          return;
        }
        activateRelativeInspector(1);
      },
      () =>
        (activeToolWindow === "bottom" &&
          bottomPanelTab === "terminal" &&
          terminalTabCount > 1) ||
        (inspector && inspectorTabKeys.length > 1)
          ? COMMAND_ENABLED
          : commandDisabled("At least two tabs are required."),
    ),
    commandDefinition(
      "view.previousEditorTab",
      () => {
        if (activeToolWindow === "bottom" && bottomPanelTab === "terminal") {
          dispatchWorkbenchEvent("git-client:terminal-tab-navigate", {
            offset: -1,
          });
          return;
        }
        activateRelativeInspector(-1);
      },
      () =>
        (activeToolWindow === "bottom" &&
          bottomPanelTab === "terminal" &&
          terminalTabCount > 1) ||
        (inspector && inspectorTabKeys.length > 1)
          ? COMMAND_ENABLED
          : commandDisabled("At least two tabs are required."),
    ),
    commandDefinition(
      "view.keepEditorTabOpen",
      () => setPreviewInspectorKey(undefined),
      () =>
        inspector && previewInspectorKey === activeInspectorKey
          ? COMMAND_ENABLED
          : commandDisabled("The active tab is already kept open."),
    ),
    commandDefinition(
      "view.closeOtherEditors",
      () =>
        requestCloseInspectors(
          inspectorTabKeys.filter((key) => key !== activeInspectorKey),
        ),
      () =>
        inspector && inspectorTabKeys.length > 1
          ? COMMAND_ENABLED
          : commandDisabled("There are no other editor tabs."),
    ),
    commandDefinition(
      "view.closeAllEditors",
      () => requestCloseInspectors(inspectorTabKeys),
      editorTabAvailability,
    ),
    commandDefinition(
      "view.closeUnmodifiedEditors",
      () =>
        requestCloseInspectors(
          inspectorTabKeys.filter((key) => !dirtyInspectorKeys.has(key)),
        ),
      () =>
        inspector &&
        inspectorTabKeys.some((key) => !dirtyInspectorKeys.has(key))
          ? COMMAND_ENABLED
          : commandDisabled("There are no unmodified editor tabs."),
    ),
    commandDefinition(
      "view.closeUnpinnedEditors",
      () =>
        requestCloseInspectors(
          inspectorTabKeys.filter((key) => !pinnedInspectorKeys.has(key)),
        ),
      () =>
        inspector &&
        inspectorTabKeys.some((key) => !pinnedInspectorKeys.has(key))
          ? COMMAND_ENABLED
          : commandDisabled("There are no unpinned editor tabs."),
    ),
    commandDefinition(
      "view.closeEditorsToLeft",
      () =>
        requestCloseInspectors(inspectorTabKeys.slice(0, activeInspectorIndex)),
      () =>
        inspector && activeInspectorIndex > 0
          ? COMMAND_ENABLED
          : commandDisabled("There are no editor tabs to the left."),
    ),
    commandDefinition(
      "view.closeEditorsToRight",
      () =>
        requestCloseInspectors(
          inspectorTabKeys.slice(activeInspectorIndex + 1),
        ),
      () =>
        inspector &&
        activeInspectorIndex >= 0 &&
        activeInspectorIndex < inspectorTabKeys.length - 1
          ? COMMAND_ENABLED
          : commandDisabled("There are no editor tabs to the right."),
    ),
    commandDefinition(
      "view.closeReadOnlyEditors",
      () => requestCloseInspectors(readOnlyInspectorKeys),
      () =>
        inspector && readOnlyInspectorKeys.length > 0
          ? COMMAND_ENABLED
          : commandDisabled("There are no read-only editor tabs."),
    ),
  ];
}
