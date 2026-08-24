import { useCallback, useId, useRef } from "react";
import type { AppDialogController } from "../../../components/AppDialog";
import type { RepositoryToolKind } from "../../../components/RepositoryToolDialog";
import type { RepositoryWorkspaceStore } from "../state/repositoryWorkspaceStore";
import { inspectorKey, type InspectorState } from "../state/workspaceTypes";

export function editorTabDomId(scope: string, value: string): string {
  return `${scope}-tab-${encodeURIComponent(value)}`;
}

export function editorPanelDomId(scope: string, value: string): string {
  return `${scope}-panel-${encodeURIComponent(value)}`;
}

interface CloseLogTabStateOptions {
  readonly activeInspectorKey: string | undefined;
  readonly activeLogTabId: string;
  readonly fallbackInspectorKey: string | undefined;
  readonly logTabIds: readonly string[];
  readonly tabId: string;
}

export interface CloseLogTabState {
  readonly activeLogTabId: string;
  readonly activateInspectorKey: string | null;
  readonly focusValue: string | undefined | null;
  readonly logOpen: boolean;
  readonly logTabIds: readonly string[];
}

export function closeLogTabState({
  activeInspectorKey,
  activeLogTabId,
  fallbackInspectorKey,
  logTabIds,
  tabId,
}: CloseLogTabStateOptions): CloseLogTabState {
  const index = logTabIds.indexOf(tabId);
  const next = logTabIds.filter((candidate) => candidate !== tabId);
  const wasActive =
    activeInspectorKey === undefined && activeLogTabId === tabId;
  if (next.length === 0) {
    return {
      activeLogTabId: "log-1",
      activateInspectorKey: fallbackInspectorKey ?? null,
      focusValue: wasActive
        ? fallbackInspectorKey === undefined
          ? undefined
          : `inspector:${fallbackInspectorKey}`
        : null,
      logOpen: false,
      logTabIds: ["log-1"],
    };
  }
  const nextActiveLogTabId =
    activeLogTabId === tabId
      ? (next[Math.min(Math.max(index, 0), next.length - 1)] ??
        next[0] ??
        "log-1")
      : activeLogTabId;
  return {
    activeLogTabId: nextActiveLogTabId,
    activateInspectorKey: null,
    focusValue: wasActive ? `log:${nextActiveLogTabId}` : null,
    logOpen: true,
    logTabIds: next,
  };
}

interface RepositoryTabCoordinatorOptions {
  readonly activeInspectorKey: string | undefined;
  readonly activeLogTabId: string;
  readonly closeInspectors: (keys: readonly string[]) => void;
  readonly dialog: AppDialogController;
  readonly dirtyInspectorKeys: ReadonlySet<string>;
  readonly inspectorTabs: readonly InspectorState[];
  readonly logOpen: boolean;
  readonly logTabIds: readonly string[];
  readonly onOpenRepositoryTool: (kind: RepositoryToolKind) => void;
  readonly setActiveInspectorKey: RepositoryWorkspaceStore["setActiveInspectorKey"];
  readonly setActiveLogTabId: RepositoryWorkspaceStore["setActiveLogTabId"];
  readonly setDirtyInspectorKeys: RepositoryWorkspaceStore["setDirtyInspectorKeys"];
  readonly setLogOpen: RepositoryWorkspaceStore["setLogOpen"];
  readonly setLogTabIds: RepositoryWorkspaceStore["setLogTabIds"];
  readonly setPreviewInspectorKey: RepositoryWorkspaceStore["setPreviewInspectorKey"];
  readonly setRepositoryViewMode: RepositoryWorkspaceStore["setRepositoryViewMode"];
}

export function useRepositoryTabCoordinator({
  activeInspectorKey,
  activeLogTabId,
  closeInspectors,
  dialog,
  dirtyInspectorKeys,
  inspectorTabs,
  logOpen,
  logTabIds,
  onOpenRepositoryTool,
  setActiveInspectorKey,
  setActiveLogTabId,
  setDirtyInspectorKeys,
  setLogOpen,
  setLogTabIds,
  setPreviewInspectorKey,
  setRepositoryViewMode,
}: RepositoryTabCoordinatorOptions) {
  const editorTabsId = useId();
  const nextLogTabNumber = useRef(2);

  const setInspectorDirty = useCallback(
    (key: string, dirty: boolean): void => {
      if (dirty) {
        setPreviewInspectorKey((current) =>
          current === key ? undefined : current,
        );
      }
      setDirtyInspectorKeys((current) => {
        if (current.has(key) === dirty) return current;
        const next = new Set(current);
        if (dirty) next.add(key);
        else next.delete(key);
        return next;
      });
    },
    [setDirtyInspectorKeys, setPreviewInspectorKey],
  );

  const requestCloseInspectors = useCallback(
    async (keys: readonly string[]): Promise<void> => {
      const uniqueKeys = [...new Set(keys)];
      const dirtyCount = uniqueKeys.filter((key) =>
        dirtyInspectorKeys.has(key),
      ).length;
      if (dirtyCount > 0) {
        const accepted = await dialog.confirm({
          title:
            dirtyCount === 1
              ? "Discard unsaved editor changes?"
              : `Discard changes in ${dirtyCount} editor tabs?`,
          description: `${dirtyCount} file${dirtyCount === 1 ? " has" : "s have"} changes that have not been written to the working tree.`,
          impact: "Unsaved editor content will be lost.",
          confirmLabel:
            uniqueKeys.length === 1
              ? "Discard and close"
              : "Discard and close tabs",
          dangerous: true,
        });
        if (!accepted) return;
      }
      closeInspectors(uniqueKeys);
    },
    [closeInspectors, dirtyInspectorKeys, dialog],
  );

  const requestCloseInspector = useCallback(
    (key: string): Promise<void> => requestCloseInspectors([key]),
    [requestCloseInspectors],
  );

  const openNewLogTab = useCallback((): void => {
    const tabId = `log-${nextLogTabNumber.current}`;
    nextLogTabNumber.current += 1;
    setLogTabIds((current) => [...current, tabId]);
    setActiveLogTabId(tabId);
    setActiveInspectorKey(undefined);
    setRepositoryViewMode("history");
    setLogOpen(true);
  }, [
    setActiveInspectorKey,
    setActiveLogTabId,
    setLogOpen,
    setLogTabIds,
    setRepositoryViewMode,
  ]);

  const openGitLogTab = useCallback((): void => {
    if (logOpen) {
      openNewLogTab();
      return;
    }
    if (logTabIds.length === 0) setLogTabIds(["log-1"]);
    setActiveLogTabId(logTabIds[0] ?? "log-1");
    setActiveInspectorKey(undefined);
    setRepositoryViewMode("history");
    setLogOpen(true);
  }, [
    logOpen,
    logTabIds,
    openNewLogTab,
    setActiveLogTabId,
    setActiveInspectorKey,
    setLogOpen,
    setLogTabIds,
    setRepositoryViewMode,
  ]);

  const focusEditorTab = useCallback(
    (value: string | undefined): void => {
      window.requestAnimationFrame(() => {
        if (value) {
          document.getElementById(editorTabDomId(editorTabsId, value))?.focus();
          return;
        }
        document.querySelector<HTMLElement>("[data-open-git-log]")?.focus();
      });
    },
    [editorTabsId],
  );

  const closeLogTab = useCallback(
    (tabId: string): void => {
      const transition = closeLogTabState({
        activeInspectorKey,
        activeLogTabId,
        fallbackInspectorKey:
          inspectorTabs[0] === undefined
            ? undefined
            : inspectorKey(inspectorTabs[0]),
        logTabIds,
        tabId,
      });
      setLogTabIds(transition.logTabIds);
      setActiveLogTabId(transition.activeLogTabId);
      setLogOpen(transition.logOpen);
      if (transition.activateInspectorKey !== null) {
        setActiveInspectorKey(transition.activateInspectorKey);
      }
      if (transition.focusValue !== null) focusEditorTab(transition.focusValue);
    },
    [
      activeInspectorKey,
      activeLogTabId,
      focusEditorTab,
      inspectorTabs,
      logTabIds,
      setActiveInspectorKey,
      setActiveLogTabId,
      setLogOpen,
      setLogTabIds,
    ],
  );

  const requestOpenRepositoryTool = useCallback(
    async (kind: RepositoryToolKind): Promise<void> => {
      if (dirtyInspectorKeys.size > 0) {
        const accepted = await dialog.confirm({
          title: "Leave editors with unsaved changes?",
          description: `${dirtyInspectorKeys.size} editor tab(s) contain unsaved changes.`,
          impact: "Unsaved editor content will be lost.",
          confirmLabel: "Discard and continue",
          dangerous: true,
        });
        if (!accepted) return;
      }
      onOpenRepositoryTool(kind);
    },
    [dirtyInspectorKeys.size, onOpenRepositoryTool, dialog],
  );

  return {
    closeLogTab,
    editorTabsId,
    nextLogTabNumber,
    openGitLogTab,
    openNewLogTab,
    requestCloseInspector,
    requestCloseInspectors,
    requestOpenRepositoryTool,
    setInspectorDirty,
  };
}
