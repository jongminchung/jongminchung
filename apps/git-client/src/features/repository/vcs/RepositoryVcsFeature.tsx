import { BottomPanel } from "../../../components/BottomPanel";
import {
  useRepositoryEditorCapability,
  useRepositoryToolWindowCapability,
  useRepositoryVcsCapability,
} from "../RepositoryWorkspaceFeatureContext";

export function RepositoryVcsFeature() {
  const editor = useRepositoryEditorCapability();
  const vcs = useRepositoryVcsCapability();
  const toolWindows = useRepositoryToolWindowCapability();
  const {
    bottomCollapsed,
    bottomPanelHeight,
    bottomPanelTab,
    findResults,
    openInspector,
    openStashDiff,
    repository,
    sessionApplyShelf,
    sessionClearGitConsole,
    sessionCreateLocalHistoryPatch,
    sessionCreateShelf,
    sessionDeleteShelf,
    sessionExecuteOperation,
    sessionGitConsoleEntries,
    sessionListLocalHistoryActivities,
    sessionLoadLocalHistoryDiff,
    sessionLoadStashFiles,
    sessionPutLocalHistoryLabel,
    sessionReadLocalHistoryActivity,
    sessionRecoveryEntries,
    sessionRestoreRecoveryEntry,
    sessionRevertLocalHistory,
    sessionShelves,
    sessionStashes,
    setBottomCollapsed,
    setBottomPanelHeight,
    setBottomPanelTab,
    setProjectSearchInitialQuery,
    setProjectSearchSurface,
    setRepositoryViewMode,
    terminalAvailability,
  } = { ...editor, ...vcs, ...toolWindows };

  return (
    <>
      <BottomPanel
        collapsed={bottomCollapsed}
        height={bottomPanelHeight}
        active={bottomPanelTab}
        terminalAvailability={terminalAvailability}
        onApplyShelf={(shelfId, drop) => void sessionApplyShelf(shelfId, drop)}
        onCreateShelf={(message, paths) =>
          void sessionCreateShelf(message, paths)
        }
        onDeleteShelf={(shelfId) => void sessionDeleteShelf(shelfId)}
        onLoadStashFiles={(stash) => sessionLoadStashFiles(stash.selector)}
        onOpenStashDiff={openStashDiff}
        onOperation={sessionExecuteOperation}
        onRestoreRecovery={sessionRestoreRecoveryEntry}
        onToggle={() => setBottomCollapsed((value) => !value)}
        onHeightChange={setBottomPanelHeight}
        onActiveChange={setBottomPanelTab}
        recoveryEntries={sessionRecoveryEntries}
        gitConsoleEntries={sessionGitConsoleEntries}
        onClearGitConsole={sessionClearGitConsole}
        onLoadLocalHistoryActivities={sessionListLocalHistoryActivities}
        onLoadLocalHistoryActivity={sessionReadLocalHistoryActivity}
        onLoadLocalHistoryDiff={sessionLoadLocalHistoryDiff}
        onCreateLocalHistoryPatch={sessionCreateLocalHistoryPatch}
        onPutLocalHistoryLabel={sessionPutLocalHistoryLabel}
        findResults={findResults}
        onOpenFindResult={(result) => {
          setRepositoryViewMode("history");
          openInspector({
            revision: repository.snapshot.headOid ?? "HEAD",
            source: { kind: "workingTree" },
            path: result.path,
            tab: "file",
            line: result.line,
            column: result.column,
          });
        }}
        onSearchAgain={() => {
          setProjectSearchInitialQuery("");
          setProjectSearchSurface("find");
        }}
        onRevertLocalHistory={sessionRevertLocalHistory}
        repositoryId={repository.snapshot.id}
        repositoryName={repository.snapshot.name}
        shelves={sessionShelves}
        stashes={sessionStashes}
        status={repository.status}
      />
    </>
  );
}
