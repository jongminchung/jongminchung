import { useCallback, useMemo } from "react";
import type { GitSessionCapabilities } from "../../../application/git-session/ports/GitSessionCapabilities";
import { dispatchWorkbenchEvent } from "../../../application/workbench-events/WorkbenchEventPort";
import type {
  EditorAction,
  EditorSearchAction,
} from "../../../components/codeMirrorSearch";
import type { RepositoryToolKind } from "../../../components/RepositoryToolDialog";
import {
  COMMAND_ENABLED,
  commandDisabled,
  type CommandDefinition,
} from "../../../domain/commands";
import type { RepositoryView } from "../../../domain/types";
import type { RepositoryReviewState } from "../review/useRepositoryReviewState";
import { inspectorKey } from "../state/workspaceTypes";
import type { RepositoryToolWindowState } from "../tool-windows/useRepositoryToolWindowState";
import { useRepositoryBookmarkController } from "./useRepositoryBookmarkController";
import { useRepositoryEditorController } from "./useRepositoryEditorController";
import { useRepositoryEditorFeatures } from "./useRepositoryEditorFeatures";
import {
  editorTabDomId,
  useRepositoryTabCoordinator,
} from "./useRepositoryTabCoordinator";

type EditorReviewPort = Pick<
  RepositoryReviewState,
  "repositoryViewMode" | "setRepositoryViewMode"
>;

type EditorToolWindowPort = Pick<
  RepositoryToolWindowState,
  | "activeLogTabId"
  | "logOpen"
  | "logTabIds"
  | "setActiveLogTabId"
  | "setLogOpen"
  | "setLogTabIds"
  | "dialog"
>;

export function useRepositoryEditorFeatureController({
  onDirtyEditorCountChange,
  onOpenRepositoryTool,
  repository,
  review,
  session,
  toolWindows,
}: {
  readonly onDirtyEditorCountChange: (count: number) => void;
  readonly onOpenRepositoryTool: (kind: RepositoryToolKind) => void;
  readonly repository: RepositoryView;
  readonly review: EditorReviewPort;
  readonly session: {
    readonly queries: Pick<
      GitSessionCapabilities["queries"],
      "loadFiles" | "readFile" | "reload"
    >;
    readonly mutations: Pick<
      GitSessionCapabilities["mutations"],
      "writeWorkingTreeFile"
    >;
  };
  readonly toolWindows: EditorToolWindowPort;
}) {
  const controller = useRepositoryEditorController({
    loadFiles: session.queries.loadFiles,
    onDirtyEditorCountChange,
    repository,
  });
  const features = useRepositoryEditorFeatures({
    inspector: controller.inspector,
    loadFile: session.queries.readFile,
    openInspector: controller.openInspector,
    reload: session.queries.reload,
    repository,
    writeWorkingTreeFile: session.mutations.writeWorkingTreeFile,
  });
  const bookmarks = useRepositoryBookmarkController({
    openInspector: controller.openInspector,
    repository,
  });
  const tabs = useRepositoryTabCoordinator({
    activeInspectorKey: controller.activeInspectorKey,
    activeLogTabId: toolWindows.activeLogTabId,
    closeInspectors: controller.closeInspectors,
    dialog: toolWindows.dialog,
    dirtyInspectorKeys: controller.dirtyInspectorKeys,
    inspectorTabs: controller.inspectorTabs,
    logOpen: toolWindows.logOpen,
    logTabIds: toolWindows.logTabIds,
    onOpenRepositoryTool,
    setActiveInspectorKey: controller.setActiveInspectorKey,
    setActiveLogTabId: toolWindows.setActiveLogTabId,
    setDirtyInspectorKeys: controller.setDirtyInspectorKeys,
    setLogOpen: toolWindows.setLogOpen,
    setLogTabIds: toolWindows.setLogTabIds,
    setPreviewInspectorKey: controller.setPreviewInspectorKey,
    setRepositoryViewMode: review.setRepositoryViewMode,
  });
  const inspectorTabKeys = useMemo(
    () => controller.inspectorTabs.map((tab) => inspectorKey(tab)),
    [controller.inspectorTabs],
  );
  const activeInspectorIndex = controller.activeInspectorKey
    ? inspectorTabKeys.indexOf(controller.activeInspectorKey)
    : -1;
  const { setActiveInspectorKey } = controller;
  const { setRepositoryViewMode } = review;
  const activateRelativeInspector = useCallback(
    (offset: -1 | 1): void => {
      if (activeInspectorIndex < 0 || inspectorTabKeys.length < 2) return;
      const nextIndex =
        (activeInspectorIndex + offset + inspectorTabKeys.length) %
        inspectorTabKeys.length;
      setActiveInspectorKey(inspectorTabKeys[nextIndex]);
      setRepositoryViewMode("history");
    },
    [
      activeInspectorIndex,
      inspectorTabKeys,
      setActiveInspectorKey,
      setRepositoryViewMode,
    ],
  );
  const editorTabAvailability = (): ReturnType<
    CommandDefinition["availability"]
  > =>
    controller.inspector
      ? COMMAND_ENABLED
      : commandDisabled("There is no active file editor tab.");
  const readOnlyInspectorKeys = useMemo(
    () =>
      controller.inspectorTabs
        .filter(
          (tab) =>
            (tab.scratchId === undefined &&
              tab.source.kind !== "workingTree") ||
            tab.tab === "tree",
        )
        .map((tab) => inspectorKey(tab)),
    [controller.inspectorTabs],
  );
  const dispatchEditorSearch = useCallback(
    (action: EditorSearchAction): boolean =>
      !dispatchWorkbenchEvent(
        "git-client:editor-search",
        { action },
        { cancelable: true },
      ),
    [],
  );
  const dispatchEditorAction = useCallback(
    (action: EditorAction): boolean =>
      !dispatchWorkbenchEvent(
        "git-client:editor-action",
        { action },
        { cancelable: true },
      ),
    [],
  );
  const editorActionAvailability = useCallback(
    (
      requiresEditable: boolean,
    ): ReturnType<CommandDefinition["availability"]> => {
      const activeEditor =
        document.activeElement instanceof HTMLElement
          ? document.activeElement.closest<HTMLElement>(".cm-editor")
          : null;
      if (activeEditor === null) {
        return commandDisabled("Place the caret in a file editor first.");
      }
      const editable =
        activeEditor.querySelector<HTMLElement>(".cm-content")
          ?.contentEditable === "true";
      return !requiresEditable || editable
        ? COMMAND_ENABLED
        : commandDisabled("The active file editor is read-only.");
    },
    [],
  );
  const focusCurrentSearch = useCallback((): void => {
    if (dispatchEditorSearch("find")) return;
    const focusedDiff =
      document.activeElement instanceof HTMLElement
        ? document.activeElement.closest<HTMLElement>("[data-diff-viewer]")
        : null;
    const search =
      focusedDiff?.querySelector<HTMLInputElement>("[data-command-search]") ??
      document.querySelector<HTMLInputElement>(
        review.repositoryViewMode === "history"
          ? '[data-command-search="history"]'
          : '[data-command-search="changes"]',
      ) ??
      document.querySelector<HTMLInputElement>("[data-command-search]");
    search?.focus();
    search?.select();
  }, [dispatchEditorSearch, review.repositoryViewMode]);
  const { editorTabsId, requestCloseInspector: closeInspector } = tabs;
  const { activeInspectorKey, inspectorTabs } = controller;
  const closeInspectorEditorTab = useCallback(
    async (key: string): Promise<void> => {
      const closingIndex = inspectorTabs.findIndex(
        (candidate) => inspectorKey(candidate) === key,
      );
      const remaining = inspectorTabs.filter(
        (candidate) => inspectorKey(candidate) !== key,
      );
      const replacement =
        remaining[Math.min(Math.max(closingIndex, 0), remaining.length - 1)] ??
        remaining.at(-1);
      const fallbackValue = replacement
        ? `inspector:${inspectorKey(replacement)}`
        : toolWindows.logOpen
          ? `log:${toolWindows.activeLogTabId}`
          : undefined;
      const wasActive = activeInspectorKey === key;

      await closeInspector(key);
      if (!wasActive) return;
      window.requestAnimationFrame(() => {
        const retainedTab = document.getElementById(
          editorTabDomId(editorTabsId, `inspector:${key}`),
        );
        if (retainedTab) {
          retainedTab.focus();
          return;
        }
        if (fallbackValue) {
          document
            .getElementById(editorTabDomId(editorTabsId, fallbackValue))
            ?.focus();
          return;
        }
        document.querySelector<HTMLElement>("[data-open-git-log]")?.focus();
      });
    },
    [
      activeInspectorKey,
      closeInspector,
      editorTabsId,
      inspectorTabs,
      toolWindows.activeLogTabId,
      toolWindows.logOpen,
    ],
  );

  return {
    ...controller,
    ...features,
    ...bookmarks,
    ...tabs,
    activateRelativeInspector,
    activeInspectorIndex,
    closeInspectorEditorTab,
    dispatchEditorAction,
    dispatchEditorSearch,
    editorActionAvailability,
    editorTabAvailability,
    focusCurrentSearch,
    inspectorTabKeys,
    readOnlyInspectorKeys,
  };
}

export type RepositoryEditorFeatureController = ReturnType<
  typeof useRepositoryEditorFeatureController
>;
