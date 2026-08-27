import { TabsContent } from "@jongminchung/ui/components/tabs";
import type { CSSProperties } from "react";
import { selectPatchImportPath } from "../../../application/desktop/DesktopPort";
import { BranchTree } from "../../../components/BranchTree";
import { CommitLog } from "../../../components/CommitLog";
import { DetailsPane } from "../../../components/DetailsPane";
import { RevisionComparison } from "../../../components/RevisionComparison";
import type { DiffPreferences } from "../../../domain/changeReview";
import { toVoidHandler } from "../../../domain/toVoidHandler";
import type { DiffOptions } from "../../../shared/contracts/model/index";
import {
  editorPanelDomId,
  editorTabDomId,
} from "../editor/useRepositoryTabCoordinator";
import {
  useRepositoryEditorCapability,
  useRepositoryReviewCapability,
  useRepositoryToolWindowCapability,
  useRepositoryVcsCapability,
} from "../RepositoryWorkspaceFeatureContext";

function nativeDiffOptions(preferences: DiffPreferences): DiffOptions {
  return {
    whitespace: preferences.whitespace,
    contextLines:
      preferences.contextLines === "full" ? null : preferences.contextLines,
  };
}

export function RepositoryReviewFeature() {
  const review = useRepositoryReviewCapability();
  const editor = useRepositoryEditorCapability();
  const vcs = useRepositoryVcsCapability();
  const toolWindows = useRepositoryToolWindowCapability();
  const {
    activeLogTabId,
    availability,
    commitFiles,
    commitFilesLoading,
    commitSignature,
    dialog,
    diffPreferences,
    editorTabsId,
    historyContent,
    historyDiff,
    historyParentRevision,
    historyPreview,
    historyReviewWidth,
    historySelectedPath,
    historySubmodule,
    logIndexing,
    logIndexingEnabled,
    logOpen,
    logTabIds,
    onAddRepository,
    openInspector,
    openNewLogTab,
    primaryCommit,
    productSettings,
    repository,
    requestOpenRepositoryTool,
    revisionComparison,
    runAction,
    selectRef,
    selectRelative,
    selectedOids,
    selectedRef,
    sessionExecuteOperation,
    sessionFixture,
    sessionHasMoreCommits,
    sessionImportPatch,
    sessionIndexLog,
    sessionLoadCommitDiff,
    sessionLoadLog,
    sessionLogError,
    sessionLogLoading,
    sessionReadFile,
    sessionReload,
    setContextPosition,
    setDiffPreferences,
    setHistoryParentRevision,
    setHistoryReviewWidth,
    setHistorySelectedPath,
    setLogIndexing,
    setLogIndexingEnabled,
    setSelectedOids,
    setToast,
  } = { ...review, ...editor, ...vcs, ...toolWindows };

  return (
    <>
      {logOpen &&
        logTabIds.map((tabId) => {
          const value = `log:${tabId}`;
          return (
            <TabsContent
              aria-labelledby={editorTabDomId(editorTabsId, value)}
              className={`editorSurface editorSurface [height:100%] [min-height:0] [min-width:0] [&[hidden]]:[display:none]`}
              id={editorPanelDomId(editorTabsId, value)}
              keepMounted
              key={tabId}
              value={value}
            >
              {tabId === activeLogTabId && (
                <div
                  className={`mainPanes mainPanes [display:grid] [height:100%] [min-height:0] [min-width:0] [grid-template-columns:30px_minmax(0,_1fr)_var(--details-pane-width,_253px)] max-[900px]:[grid-template-columns:30px_minmax(0,_1fr)] max-[900px]:[&>_*:last-child]:[display:none] [html[data-distraction-free-mode=true]_&>*:first-child]:hidden! [html[data-distraction-free-mode=true]_&>*:last-child]:hidden! [html[data-presentation-mode=true]_&>*:first-child]:hidden! [html[data-presentation-mode=true]_&>*:last-child]:hidden!`}
                  style={
                    {
                      "--history-review-width": `${historyReviewWidth}px`,
                    } as CSSProperties
                  }
                >
                  <BranchTree
                    compact
                    onAdd={onAddRepository}
                    onActivate={() => void requestOpenRepositoryTool("refs")}
                    onSelect={selectRef}
                    refs={repository.refs}
                    selected={selectedRef}
                  />
                  <CommitLog
                    ahead={repository.status.ahead}
                    behind={repository.status.behind}
                    canCherryPick={availability.cherryPick}
                    commits={repository.commits}
                    hasMore={sessionHasMoreCommits}
                    loading={sessionLogLoading}
                    error={sessionLogError}
                    refs={repository.refs}
                    onLoad={sessionLoadLog}
                    onOpenNewTab={openNewLogTab}
                    indexing={logIndexing}
                    indexingEnabled={logIndexingEnabled}
                    powerSaveMode={productSettings.powerSaveMode}
                    relativeTimeBaseSeconds={
                      sessionFixture
                        ? repository.commits[0]?.authoredAt
                        : undefined
                    }
                    onEnableIndexing={async (filters, order) => {
                      setLogIndexing(true);
                      try {
                        await sessionIndexLog(filters, order);
                        setLogIndexingEnabled(true);
                      } finally {
                        setLogIndexing(false);
                      }
                    }}
                    onCherryPick={() => void runAction("cherryPick")}
                    onImportPatch={toVoidHandler(async () => {
                      const selectedPath = await selectPatchImportPath();
                      if (selectedPath === null) return;
                      await sessionImportPatch(selectedPath);
                      setToast("Patch applied to the index and working tree.");
                    })}
                    onRefresh={() => void sessionReload()}
                    onContextMenu={(event, commit) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (!selectedOids.includes(commit.oid))
                        setSelectedOids([commit.oid]);
                      setContextPosition({
                        x: event.clientX,
                        y: event.clientY,
                      });
                    }}
                    onSelectionChange={setSelectedOids}
                    selectedOids={selectedOids}
                    upstream={repository.status.upstream}
                  />
                  {revisionComparison ? (
                    <RevisionComparison
                      from={revisionComparison.from}
                      loading={revisionComparison.loading}
                      onPreferencesChange={setDiffPreferences}
                      onReviewWidthChange={(width) =>
                        setHistoryReviewWidth(
                          Math.min(480, Math.max(180, Math.round(width))),
                        )
                      }
                      patch={revisionComparison.patch}
                      preferences={diffPreferences}
                      reviewWidth={historyReviewWidth}
                      readFile={sessionReadFile}
                      to={revisionComparison.to}
                    />
                  ) : (
                    <DetailsPane
                      afterContent={historyContent.after}
                      afterPreview={historyPreview.after}
                      beforeContent={historyContent.before}
                      beforePreview={historyPreview.before}
                      submoduleDiff={historySubmodule.value}
                      commit={primaryCommit}
                      diffLoading={
                        historyDiff.loading ||
                        historyContent.loading ||
                        historyPreview.loading ||
                        historySubmodule.loading
                      }
                      files={commitFiles}
                      loading={commitFilesLoading}
                      onLoadDiff={(commit, file) =>
                        sessionLoadCommitDiff(
                          commit,
                          file.path,
                          nativeDiffOptions(diffPreferences),
                          historyParentRevision ?? undefined,
                        )
                      }
                      onReadFile={sessionReadFile}
                      onRevertSelectedChanges={async () => {
                        if (!historyDiff.patch || !historySelectedPath) {
                          return;
                        }
                        const accepted = await dialog.confirm({
                          title: "Revert selected changes?",
                          description:
                            "Applies the inverse of this file change to the working tree.",
                          impact: historySelectedPath,
                          confirmLabel: "Revert selected changes",
                          dangerous: true,
                        });
                        if (!accepted) return;
                        await sessionExecuteOperation({
                          kind: "applyPatch",
                          patch: historyDiff.patch,
                          cached: false,
                          reverse: true,
                        });
                      }}
                      signature={commitSignature}
                      parentRevision={historyParentRevision}
                      patch={historyDiff.patch}
                      preferences={diffPreferences}
                      reviewWidth={historyReviewWidth}
                      selectedPath={historySelectedPath}
                      onNext={() => selectRelative("child")}
                      onPrevious={() => selectRelative("parent")}
                      onReviewWidthChange={(width) =>
                        setHistoryReviewWidth(
                          Math.min(480, Math.max(180, Math.round(width))),
                        )
                      }
                      onParentRevisionChange={setHistoryParentRevision}
                      onPreferencesChange={setDiffPreferences}
                      onSelectFile={(file) => setHistorySelectedPath(file.path)}
                      onInspectFile={(file, tab) => {
                        if (primaryCommit) {
                          openInspector({
                            revision: primaryCommit.oid,
                            source: {
                              kind: "revision",
                              revision: primaryCommit.oid,
                            },
                            path: file.path,
                            tab,
                          });
                        }
                      }}
                      onOpenTree={() => {
                        if (primaryCommit) {
                          openInspector({
                            revision: primaryCommit.oid,
                            source: {
                              kind: "revision",
                              revision: primaryCommit.oid,
                            },
                            tab: "tree",
                          });
                        }
                      }}
                    />
                  )}
                </div>
              )}
            </TabsContent>
          );
        })}
    </>
  );
}
