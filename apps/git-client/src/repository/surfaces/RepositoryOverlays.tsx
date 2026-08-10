import { type ComponentProps } from "react";
import { useShallow } from "zustand/react/shallow";
import { BookmarkGroupSelectDialog } from "../../components/BookmarkGroupSelectDialog";
import { BookmarkMnemonicDialog } from "../../components/BookmarkMnemonicDialog";
import { BookmarksPopup } from "../../components/BookmarksPopup";
import {
  CodeAnalysisScopeDialog,
  type CodeAnalysisScope,
} from "../../components/CodeAnalysisScopeDialog";
import { ExportToHtmlDialog } from "../../components/ExportToHtmlDialog";
import { InspectionResultsDialog } from "../../components/InspectionResultsDialog";
import { ProcessesDialog } from "../../components/ProcessesDialog";
import { ProjectSearchDialog } from "../../components/ProjectSearchDialog";
import { RecentFindUsagesDialog } from "../../components/RecentFindUsagesDialog";
import { ReplaceInFilesDialog } from "../../components/ReplaceInFilesDialog";
import { RunInspectionDialog } from "../../components/RunInspectionDialog";
import { ScratchFileChooserDialog } from "../../components/ScratchFileChooserDialog";
import { StackTraceDialog } from "../../components/StackTraceDialog";
import { VcsOperationsPopup } from "../../components/VcsOperationsPopup";
import {
  addLineBookmarkToGroup,
  allLineBookmarks,
  assignBookmarkMnemonic,
  describeBookmark,
  setDefaultBookmarkGroup,
  type BookmarkMnemonic,
} from "../../domain/bookmarks";
import type { CodeInspectionId } from "../../domain/codeAnalysis";
import type { ProductSettings } from "../../domain/productSettings";
import { SCRATCH_LANGUAGES } from "../../domain/scratchFiles";
import type { RepositoryView } from "../../domain/types";
import type { GitSessionController } from "../../git-session/useGitSessionController";
import { useRepositoryWorkspaceStore } from "../state/RepositoryWorkspaceStoreProvider";
import type { BookmarkMnemonicTarget, InspectorState } from "../state/workspaceTypes";

interface RepositoryOverlaysProps {
  readonly activity: ComponentProps<typeof ProcessesDialog>["activity"];
  readonly cancelActivity: ComponentProps<typeof ProcessesDialog>["onCancelActivity"];
  readonly chooseBookmarkMnemonic: (
    target: BookmarkMnemonicTarget,
    mnemonic: BookmarkMnemonic,
    description: string,
  ) => Promise<void>;
  readonly createScratchFile: ComponentProps<typeof ScratchFileChooserDialog>["onChoose"];
  readonly executeCommand: ComponentProps<typeof VcsOperationsPopup>["onExecute"];
  readonly exportToHtml: ComponentProps<typeof ExportToHtmlDialog>["onExport"];
  readonly inspector: InspectorState | undefined;
  readonly openCodeIssue: ComponentProps<typeof InspectionResultsDialog>["onOpenIssue"];
  readonly openInspector: (next: InspectorState, keepOpen?: boolean) => void;
  readonly openLineBookmark: ComponentProps<typeof BookmarksPopup>["onOpenBookmark"];
  readonly openStackFrame: ComponentProps<typeof StackTraceDialog>["onOpenFrame"];
  readonly productSettings: ProductSettings;
  readonly replaceInProjectFiles: ComponentProps<typeof ReplaceInFilesDialog>["onReplace"];
  readonly repository: RepositoryView;
  readonly runCodeCleanup: (scope: CodeAnalysisScope) => Promise<void>;
  readonly runCodeInspection: (scope: CodeAnalysisScope, id?: CodeInspectionId) => Promise<void>;
  readonly searchProjectText: GitSessionController["searchProjectText"];
  readonly vcsOperationGroups: ComponentProps<typeof VcsOperationsPopup>["groups"];
}

export function RepositoryOverlays({
  activity,
  cancelActivity,
  chooseBookmarkMnemonic,
  createScratchFile,
  executeCommand,
  exportToHtml,
  inspector,
  openCodeIssue,
  openInspector,
  openLineBookmark,
  openStackFrame,
  productSettings,
  replaceInProjectFiles,
  repository,
  runCodeCleanup,
  runCodeInspection,
  searchProjectText,
  vcsOperationGroups,
}: RepositoryOverlaysProps) {
  const {
    bookmarkGroupTarget,
    bookmarkMnemonicTarget,
    bookmarks,
    bookmarksPopupMode,
    codeAnalysisRequest,
    editorStatus,
    exportToHtmlOpen,
    inspectionResults,
    processesOpen,
    projectSearchInitialQuery,
    projectSearchSurface,
    recentFindUsages,
    recentFindUsagesOpen,
    replaceInFilesOpen,
    runInspectionOpen,
    scratchFileChooserOpen,
    setBookmarkGroupTarget,
    setBookmarkMnemonicTarget,
    setBookmarks,
    setBookmarksPopupMode,
    setBottomCollapsed,
    setBottomPanelTab,
    setCodeAnalysisRequest,
    setExportToHtmlOpen,
    setFindResults,
    setInspectionResults,
    setProcessesOpen,
    setProjectSearchSurface,
    setRecentFindUsages,
    setRecentFindUsagesOpen,
    setReplaceInFilesOpen,
    setRepositoryViewMode,
    setRunInspectionOpen,
    setScratchFileChooserOpen,
    setStackTraceOpen,
    setVcsOperationsOpen,
    stackTraceOpen,
    vcsOperationsOpen,
  } = useRepositoryWorkspaceStore(
    useShallow((state) => ({
      bookmarkGroupTarget: state.bookmarkGroupTarget,
      bookmarkMnemonicTarget: state.bookmarkMnemonicTarget,
      bookmarks: state.bookmarks,
      bookmarksPopupMode: state.bookmarksPopupMode,
      codeAnalysisRequest: state.codeAnalysisRequest,
      editorStatus: state.editorStatus,
      exportToHtmlOpen: state.exportToHtmlOpen,
      inspectionResults: state.inspectionResults,
      processesOpen: state.processesOpen,
      projectSearchInitialQuery: state.projectSearchInitialQuery,
      projectSearchSurface: state.projectSearchSurface,
      recentFindUsages: state.recentFindUsages,
      recentFindUsagesOpen: state.recentFindUsagesOpen,
      replaceInFilesOpen: state.replaceInFilesOpen,
      runInspectionOpen: state.runInspectionOpen,
      scratchFileChooserOpen: state.scratchFileChooserOpen,
      setBookmarkGroupTarget: state.setBookmarkGroupTarget,
      setBookmarkMnemonicTarget: state.setBookmarkMnemonicTarget,
      setBookmarks: state.setBookmarks,
      setBookmarksPopupMode: state.setBookmarksPopupMode,
      setBottomCollapsed: state.setBottomCollapsed,
      setBottomPanelTab: state.setBottomPanelTab,
      setCodeAnalysisRequest: state.setCodeAnalysisRequest,
      setExportToHtmlOpen: state.setExportToHtmlOpen,
      setFindResults: state.setFindResults,
      setInspectionResults: state.setInspectionResults,
      setProcessesOpen: state.setProcessesOpen,
      setProjectSearchSurface: state.setProjectSearchSurface,
      setRecentFindUsages: state.setRecentFindUsages,
      setRecentFindUsagesOpen: state.setRecentFindUsagesOpen,
      setReplaceInFilesOpen: state.setReplaceInFilesOpen,
      setRepositoryViewMode: state.setRepositoryViewMode,
      setRunInspectionOpen: state.setRunInspectionOpen,
      setScratchFileChooserOpen: state.setScratchFileChooserOpen,
      setStackTraceOpen: state.setStackTraceOpen,
      setVcsOperationsOpen: state.setVcsOperationsOpen,
      stackTraceOpen: state.stackTraceOpen,
      vcsOperationsOpen: state.vcsOperationsOpen,
    })),
  );

  return (
    <>
      {scratchFileChooserOpen && (
        <ScratchFileChooserDialog
          languages={SCRATCH_LANGUAGES}
          onChoose={createScratchFile}
          onClose={() => setScratchFileChooserOpen(false)}
        />
      )}
      {exportToHtmlOpen && (
        <ExportToHtmlDialog
          directoryName={repository.snapshot.path}
          fileName={inspector?.path}
          onClose={() => setExportToHtmlOpen(false)}
          onExport={exportToHtml}
          selectionAvailable={Boolean(editorStatus?.selectedText)}
        />
      )}
      {replaceInFilesOpen && (
        <ReplaceInFilesDialog
          onClose={() => setReplaceInFilesOpen(false)}
          onOpenResult={(result) => {
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
          onReplace={replaceInProjectFiles}
          search={searchProjectText}
        />
      )}
      {bookmarksPopupMode && (
        <BookmarksPopup
          mode={bookmarksPopupMode}
          onClose={() => setBookmarksPopupMode(undefined)}
          onOpenBookmark={openLineBookmark}
          state={bookmarks}
        />
      )}
      {bookmarkMnemonicTarget && (
        <BookmarkMnemonicDialog
          assigned={
            new Set(
              allLineBookmarks(bookmarks).flatMap((bookmark) =>
                bookmark.mnemonic ? [bookmark.mnemonic] : [],
              ),
            )
          }
          creating={bookmarkMnemonicTarget.creating}
          current={bookmarkMnemonicTarget.current}
          description={bookmarkMnemonicTarget.description}
          onChoose={(mnemonic, description) =>
            void chooseBookmarkMnemonic(bookmarkMnemonicTarget, mnemonic, description)
          }
          onClose={() => setBookmarkMnemonicTarget(undefined)}
        />
      )}
      {bookmarkGroupTarget && (
        <BookmarkGroupSelectDialog
          groups={bookmarks.groups}
          onClose={() => setBookmarkGroupTarget(undefined)}
          onSelect={(groupId, useAsDefault) => {
            setBookmarks((current) => {
              let next = addLineBookmarkToGroup(
                current,
                bookmarkGroupTarget.location,
                bookmarkGroupTarget.bookmarkId,
                groupId,
                bookmarkGroupTarget.mnemonic,
              );
              if (bookmarkGroupTarget.mnemonic !== null) {
                next = assignBookmarkMnemonic(
                  next,
                  bookmarkGroupTarget.bookmarkId,
                  bookmarkGroupTarget.mnemonic,
                );
              }
              if (bookmarkGroupTarget.description !== "") {
                next = describeBookmark(
                  next,
                  bookmarkGroupTarget.bookmarkId,
                  bookmarkGroupTarget.description,
                );
              }
              return useAsDefault ? setDefaultBookmarkGroup(next, groupId) : next;
            });
            setBookmarkGroupTarget(undefined);
          }}
        />
      )}
      {projectSearchSurface && (
        <ProjectSearchDialog
          initialQuery={projectSearchInitialQuery}
          onClose={() => setProjectSearchSurface(undefined)}
          onOpenInFindWindow={(query, options, results) => {
            const next = { query, options, results };
            setFindResults(next);
            setRecentFindUsages((current) =>
              [next, ...current.filter((session) => session.query !== query)].slice(0, 30),
            );
            setBottomPanelTab("find");
            setBottomCollapsed(false);
          }}
          onOpenResult={(result) => {
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
          search={searchProjectText}
          scrollToResults={productSettings.scrollToSearchResults}
          surface={projectSearchSurface}
          pathScope={
            projectSearchSurface === "usagesFile" || projectSearchSurface === "structure"
              ? inspector?.path
              : undefined
          }
        />
      )}
      {recentFindUsagesOpen && (
        <RecentFindUsagesDialog
          history={recentFindUsages}
          onChoose={(selected) => {
            setFindResults(selected);
            setBottomPanelTab("find");
            setBottomCollapsed(false);
            setRecentFindUsagesOpen(false);
          }}
          onClose={() => setRecentFindUsagesOpen(false)}
        />
      )}
      {runInspectionOpen && (
        <RunInspectionDialog
          onChoose={(inspectionId) => {
            setRunInspectionOpen(false);
            setCodeAnalysisRequest({
              mode: "inspect",
              inspectionId,
            });
          }}
          onClose={() => setRunInspectionOpen(false)}
        />
      )}
      {codeAnalysisRequest && (
        <CodeAnalysisScopeDialog
          currentFile={inspector?.path ?? null}
          inspectionId={codeAnalysisRequest.inspectionId}
          mode={codeAnalysisRequest.mode}
          onClose={() => setCodeAnalysisRequest(undefined)}
          onRun={(scope) =>
            codeAnalysisRequest.mode === "cleanup"
              ? runCodeCleanup(scope)
              : runCodeInspection(scope, codeAnalysisRequest.inspectionId)
          }
        />
      )}
      {inspectionResults && (
        <InspectionResultsDialog
          issues={inspectionResults.issues}
          onClose={() => setInspectionResults(undefined)}
          onOpenIssue={openCodeIssue}
          title={inspectionResults.title}
        />
      )}
      {stackTraceOpen && (
        <StackTraceDialog onClose={() => setStackTraceOpen(false)} onOpenFrame={openStackFrame} />
      )}
      {vcsOperationsOpen && (
        <VcsOperationsPopup
          groups={vcsOperationGroups}
          onClose={() => setVcsOperationsOpen(false)}
          onExecute={executeCommand}
        />
      )}
      {processesOpen && (
        <ProcessesDialog
          activity={activity}
          onCancelActivity={cancelActivity}
          onClose={() => setProcessesOpen(false)}
        />
      )}
    </>
  );
}
