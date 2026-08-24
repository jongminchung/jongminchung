import { useEffect } from "react";
import type { BottomPanelTab } from "../../../components/BottomPanel";
import type { ProductSettings } from "../../../domain/productSettings";
import type { RepositoryView } from "../../../domain/types";
import type { EditorStatus } from "../state/workspaceTypes";

interface RepositoryWorkspaceLifecycleOptions {
  readonly bottomCollapsed: boolean;
  readonly bottomPanelTab: BottomPanelTab;
  readonly editorStatus: EditorStatus | undefined;
  readonly hasEditorTabs: boolean;
  readonly onChromeModeChange: (mode: "editor" | "terminal") => void;
  readonly productSettings: ProductSettings;
  readonly repository: RepositoryView;
  readonly safeMode: boolean;
  readonly sessionLoading: boolean;
  readonly setBottomCollapsed: (value: boolean) => void;
  readonly setHistoryRewrite: (value: null) => void;
  readonly setRepositoryViewMode: (value: "history") => void;
  readonly setShareExistingRemotes: (value: undefined) => void;
  readonly setShareProjectProvider: (value: undefined) => void;
}

export function useRepositoryWorkspaceLifecycle({
  bottomCollapsed,
  bottomPanelTab,
  editorStatus,
  hasEditorTabs,
  onChromeModeChange,
  productSettings,
  repository,
  safeMode,
  sessionLoading,
  setBottomCollapsed,
  setHistoryRewrite,
  setRepositoryViewMode,
  setShareExistingRemotes,
  setShareProjectProvider,
}: RepositoryWorkspaceLifecycleOptions) {
  const terminalFocused =
    !hasEditorTabs && !bottomCollapsed && bottomPanelTab === "terminal";

  useEffect(() => {
    if (!safeMode) return;
    setBottomCollapsed(true);
    setRepositoryViewMode("history");
    setHistoryRewrite(null);
    setShareExistingRemotes(undefined);
    setShareProjectProvider(undefined);
    onChromeModeChange("editor");
  }, [
    onChromeModeChange,
    safeMode,
    setBottomCollapsed,
    setHistoryRewrite,
    setRepositoryViewMode,
    setShareExistingRemotes,
    setShareProjectProvider,
  ]);

  const baseNavigationStatus =
    sessionLoading || terminalFocused
      ? `Project(name=${repository.snapshot.name}, containerState=COMPONENT_CREATED, componentStore=${repository.snapshot.path})`
      : `PsiDirectory:${repository.snapshot.path}`;
  const navigationStatus =
    productSettings.navigationBarShowMembers && editorStatus
      ? `${baseNavigationStatus} › ${editorStatus.path} › ${editorStatus.line}:${editorStatus.column}`
      : baseNavigationStatus;

  useEffect(() => {
    onChromeModeChange(terminalFocused ? "terminal" : "editor");
  }, [onChromeModeChange, terminalFocused]);

  useEffect(() => () => onChromeModeChange("editor"), [onChromeModeChange]);

  return { navigationStatus, terminalFocused };
}
