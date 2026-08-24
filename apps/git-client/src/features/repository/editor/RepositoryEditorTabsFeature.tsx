import {
  useRepositoryEditorCapability,
  useRepositoryReviewCapability,
  useRepositoryToolWindowCapability,
  useRepositoryVcsCapability,
} from "../RepositoryWorkspaceFeatureContext";
import { RepositoryEditorTabs } from "./RepositoryEditorTabs";

export function RepositoryEditorTabsFeature() {
  const editor = useRepositoryEditorCapability();
  const review = useRepositoryReviewCapability();
  const vcs = useRepositoryVcsCapability();
  const toolWindows = useRepositoryToolWindowCapability();
  const {
    abortInProgressOperation,
    closeInspectorEditorTab,
    closeLogTab,
    dialog,
    dirtyInspectorKeys,
    editorTabsId,
    hasEditorTabs,
    inspector,
    inspectorTabs,
    leftToolWindowOpen,
    logOpen,
    logTabIds,
    pinnedInspectorKeys,
    previewInspectorKey,
    repository,
    repositoryViewMode,
    sessionExecuteOperation,
    sessionLoading,
    sessionReload,
    sessionStale,
    sideToolWindowWidth,
  } = { ...editor, ...review, ...vcs, ...toolWindows };

  if (!hasEditorTabs) return null;
  return (
    <RepositoryEditorTabs
      abortInProgressOperation={abortInProgressOperation}
      closeInspectorEditorTab={closeInspectorEditorTab}
      closeLogTab={closeLogTab}
      dialog={dialog}
      dirtyInspectorKeys={dirtyInspectorKeys}
      editorTabsId={editorTabsId}
      hasInspector={inspector !== undefined}
      inspectorTabs={inspectorTabs}
      leftToolWindowOpen={leftToolWindowOpen}
      logOpen={logOpen}
      logTabIds={logTabIds}
      pinnedInspectorKeys={pinnedInspectorKeys}
      previewInspectorKey={previewInspectorKey}
      repository={repository}
      repositoryViewMode={repositoryViewMode}
      sessionExecuteOperation={sessionExecuteOperation}
      sessionLoading={sessionLoading}
      sessionReload={sessionReload}
      sessionStale={sessionStale}
      sideToolWindowWidth={sideToolWindowWidth}
    />
  );
}
