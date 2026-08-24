import { ChangesWorkspace } from "../../../components/ChangesWorkspace";
import {
  useRepositoryEditorCapability,
  useRepositoryReviewCapability,
  useRepositoryToolWindowCapability,
  useRepositoryVcsCapability,
} from "../RepositoryWorkspaceFeatureContext";

export function RepositoryChangesFeature() {
  const editor = useRepositoryEditorCapability();
  const review = useRepositoryReviewCapability();
  const vcs = useRepositoryVcsCapability();
  const toolWindows = useRepositoryToolWindowCapability();
  const {
    changeContent,
    changeDiff,
    changePreview,
    changeSelection,
    changeSubmodule,
    changesNavigatorWidth,
    commitDraft,
    commitRailWidth,
    diffPreferences,
    onOpenPush,
    openConflict,
    openInspector,
    repository,
    sessionChangelists,
    sessionCommitChangelist,
    sessionDeleteChangelist,
    sessionExecuteOperation,
    sessionOpenWorkingTreeFile,
    sessionPreCommitCheck,
    sessionSaveChangelist,
    setChangeSelection,
    setChangesNavigatorWidth,
    setCommitDraft,
    setCommitRailWidth,
    setDiffPreferences,
    setRepositoryViewMode,
    workingEntries,
  } = { ...editor, ...review, ...vcs, ...toolWindows };

  return (
    <ChangesWorkspace
      afterContent={changeContent.after}
      afterPreview={changePreview.after}
      beforeContent={changeContent.before}
      beforePreview={changePreview.before}
      submoduleDiff={changeSubmodule.value}
      commitRailWidth={commitRailWidth}
      navigatorWidth={changesNavigatorWidth}
      changelists={sessionChangelists}
      diffLoading={
        changeDiff.loading ||
        changeContent.loading ||
        changePreview.loading ||
        changeSubmodule.loading
      }
      draft={commitDraft}
      entries={workingEntries}
      onCloseToolWindow={() => setRepositoryViewMode("history")}
      onCommitChangelist={async (...arguments_) => {
        await sessionCommitChangelist(...arguments_);
      }}
      onDeleteChangelist={sessionDeleteChangelist}
      onDraftChange={setCommitDraft}
      onInspectFile={(file, layer, tab) => {
        setRepositoryViewMode("history");
        openInspector({
          revision: repository.snapshot.headOid ?? "HEAD",
          source:
            layer === "index" ? { kind: "index" } : { kind: "workingTree" },
          path: file.path,
          tab,
        });
      }}
      onOpenConflict={openConflict}
      onOpenPush={() => onOpenPush()}
      onCommitRailWidthChange={(width) =>
        setCommitRailWidth(Math.min(480, Math.max(280, Math.round(width))))
      }
      onNavigatorWidthChange={(width) =>
        setChangesNavigatorWidth(
          Math.min(420, Math.max(190, Math.round(width))),
        )
      }
      onOpenExternally={(file) => sessionOpenWorkingTreeFile(file.path)}
      onCommitOperation={(operation) =>
        sessionExecuteOperation(operation, true)
      }
      onOperation={sessionExecuteOperation}
      onPreCommitCheck={sessionPreCommitCheck}
      onPreferencesChange={setDiffPreferences}
      onSaveChangelist={sessionSaveChangelist}
      onSelectionChange={setChangeSelection}
      patch={changeDiff.patch}
      preferences={diffPreferences}
      selection={changeSelection}
      status={repository.status}
      toolWindow
    />
  );
}
