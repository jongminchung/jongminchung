import { useEffect } from "react";
import { useShallow } from "zustand/react/shallow";
import { listenWorkbenchEvent } from "../../../application/workbench-events/WorkbenchEventPort";
import { useRepositoryWorkspaceStore } from "../state/RepositoryWorkspaceStoreProvider";

export function useRepositoryReviewState(safeMode: boolean) {
  const state = useRepositoryWorkspaceStore(
    useShallow((workspace) => ({
      selectedOids: workspace.selectedOids,
      selectedRef: workspace.selectedRef,
      repositoryViewMode: workspace.repositoryViewMode,
      changeSelection: workspace.changeSelection,
      historySelectedPath: workspace.historySelectedPath,
      historyParentRevision: workspace.historyParentRevision,
      diffPreferences: workspace.diffPreferences,
      commitDraft: workspace.commitDraft,
      historyDiff: workspace.historyDiff,
      changeDiff: workspace.changeDiff,
      historyPreview: workspace.historyPreview,
      changePreview: workspace.changePreview,
      historyContent: workspace.historyContent,
      changeContent: workspace.changeContent,
      historySubmodule: workspace.historySubmodule,
      changeSubmodule: workspace.changeSubmodule,
      contextPosition: workspace.contextPosition,
      diffState: workspace.diffState,
      revisionComparison: workspace.revisionComparison,
      conflictContent: workspace.conflictContent,
      commitFiles: workspace.commitFiles,
      commitFilesLoading: workspace.commitFilesLoading,
      commitSignature: workspace.commitSignature,
      historyRewrite: workspace.historyRewrite,
      setSelectedOids: workspace.setSelectedOids,
      setSelectedRef: workspace.setSelectedRef,
      setRepositoryViewMode: workspace.setRepositoryViewMode,
      setChangeSelection: workspace.setChangeSelection,
      setHistorySelectedPath: workspace.setHistorySelectedPath,
      setHistoryParentRevision: workspace.setHistoryParentRevision,
      setDiffPreferences: workspace.setDiffPreferences,
      setCommitDraft: workspace.setCommitDraft,
      setContextPosition: workspace.setContextPosition,
      setDiffState: workspace.setDiffState,
      setConflictContent: workspace.setConflictContent,
      setHistoryRewrite: workspace.setHistoryRewrite,
    })),
  );
  const { setRepositoryViewMode } = state;

  useEffect(
    () =>
      listenWorkbenchEvent(
        "git-client:repository-view-request",
        (requestedView) => {
          if (!safeMode && requestedView === "changes") {
            setRepositoryViewMode("changes");
          }
        },
      ),
    [safeMode, setRepositoryViewMode],
  );

  return state;
}

export type RepositoryReviewState = ReturnType<typeof useRepositoryReviewState>;
