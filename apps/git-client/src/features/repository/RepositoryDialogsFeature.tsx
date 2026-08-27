import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { CommitContextMenu } from "../../components/CommitContextMenu";
import { ConflictEditorDialog } from "../../components/ConflictEditorDialog";
import { DiffViewer } from "../../components/DiffViewer";
import { HistoryRewriteWorkspace } from "../../components/HistoryRewriteWorkspace";
import { Icon } from "../../components/Icon";
import { ShareExistingRemotesDialog } from "../../components/ShareExistingRemotesDialog";
import { ShareProjectDialog } from "../../components/ShareProjectDialog";
import { useRepositoryOverlayCapability } from "./RepositoryWorkspaceFeatureContext";

export function RepositoryDialogsFeature() {
  const {
    abortInProgressOperation,
    availability,
    bindSharedProject,
    conflictContent,
    contextPosition,
    dialog,
    diffPreferences,
    diffState,
    historyRewrite,
    onOpenPush,
    openExistingRemote,
    repository,
    requestOpenRepositoryTool,
    runAction,
    sessionExecuteOperation,
    sessionLoadHistoryRewritePreview,
    sessionRemotes,
    sessionResolveBinaryConflict,
    sessionSaveConflictResult,
    setConflictContent,
    setContextPosition,
    setDiffPreferences,
    setDiffState,
    setHistoryRewrite,
    setShareExistingRemotes,
    setShareProjectProvider,
    shareExistingRemotes,
    shareProjectProvider,
    toast,
  } = useRepositoryOverlayCapability();
  return (
    <>
      {contextPosition && (
        <CommitContextMenu
          availability={availability}
          onClose={() => setContextPosition(undefined)}
          onAction={(action) => void runAction(action)}
          x={contextPosition.x}
          y={contextPosition.y}
        />
      )}
      {diffState && (
        <section
          className={`standaloneDiff standaloneDiff [position:fixed] [inset:70px_0_23px] [z-index:var(--layer-workspace-overlay)] [display:grid] [grid-template-rows:38px_minmax(0,_1fr)] [background:var(--card)] [&>_header]:[display:flex] [&>_header]:[align-items:center] [&>_header]:[padding:0_9px] [&>_header]:[border-bottom:1px_solid_var(--border)] [&>_header_span]:[flex:1]`}
          aria-label="Standalone diff review"
        >
          <header>
            <strong>Comparison</strong>
            <span />
            <Button
              className={cn("min-h-7 px-2 text-xs")}
              onClick={() => setDiffState(undefined)}
              variant="secondary"
              size="sm"
            >
              Back to workspace
            </Button>
          </header>
          <DiffViewer
            file={diffState.file}
            loading={diffState.loading}
            mode="readOnly"
            onPreferencesChange={setDiffPreferences}
            patch={diffState.patch}
            preferences={diffPreferences}
            sourceLabel="Comparison"
          />
        </section>
      )}
      {conflictContent && (
        <ConflictEditorDialog
          content={conflictContent}
          onAbort={async () => {
            await abortInProgressOperation();
            setConflictContent(undefined);
          }}
          onClose={() => setConflictContent(undefined)}
          onContinue={async () => {
            const operation = repository.snapshot.operation;
            if (!operation || operation === "bisect") return;
            await sessionExecuteOperation({
              kind: "continue",
              operation,
            });
            setConflictContent(undefined);
          }}
          onResolveBinary={async (side) => {
            await sessionResolveBinaryConflict(conflictContent.path, side);
            setConflictContent(undefined);
          }}
          onSave={async (result) => {
            await sessionSaveConflictResult(conflictContent.path, result, true);
            setConflictContent(undefined);
          }}
          operation={repository.snapshot.operation}
        />
      )}
      {historyRewrite && (
        <HistoryRewriteWorkspace
          currentHeadOid={repository.snapshot.headOid}
          fromRevision={historyRewrite.fromRevision}
          onClose={() => setHistoryRewrite(null)}
          onExecute={(operation) => sessionExecuteOperation(operation, true)}
          onLoadPreview={sessionLoadHistoryRewritePreview}
          onOpenPush={() => {
            setHistoryRewrite(null);
            onOpenPush("HEAD", true);
          }}
          operationInProgress={repository.snapshot.operation !== null}
          squashOids={historyRewrite.squashOids}
        />
      )}
      {shareExistingRemotes && (
        <ShareExistingRemotesDialog
          onCancel={() => setShareExistingRemotes(undefined)}
          onOpenRemote={openExistingRemote}
          onShareAnyway={() => {
            setShareProjectProvider(shareExistingRemotes.provider);
            setShareExistingRemotes(undefined);
          }}
          remotes={shareExistingRemotes.remotes}
          service={
            shareExistingRemotes.provider === "gitHub" ? "GitHub" : "GitLab"
          }
        />
      )}
      {shareProjectProvider && !shareExistingRemotes && (
        <ShareProjectDialog
          currentBranch={repository.snapshot.currentBranch}
          changes={repository.status.changes}
          hasCommits={repository.snapshot.hasCommits}
          onBind={bindSharedProject}
          onClose={() => setShareProjectProvider(undefined)}
          onManageAccounts={() => void requestOpenRepositoryTool("hosting")}
          projectName={repository.snapshot.name}
          provider={shareProjectProvider}
          remoteNames={sessionRemotes.map((remote) => remote.name)}
        />
      )}
      {dialog.node}
      {toast && (
        <div
          className={`toast toast [position:fixed] [bottom:36px] [left:50%] [z-index:var(--layer-floating-panel)] [display:flex] [transform:translateX(-50%)] [align-items:center] [gap:7px] rounded-lg [padding:9px_13px] [color:var(--inverse-foreground)] [box-shadow:var(--shadow-lg)] [background:var(--inverse)]`}
        >
          <Icon name="check" size={15} />
          {toast}
        </div>
      )}
    </>
  );
}
