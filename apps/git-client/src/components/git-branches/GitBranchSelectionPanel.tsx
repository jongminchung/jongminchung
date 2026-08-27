import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import type { ReactNode, RefObject } from "react";
import type { Ref } from "../../domain/types";
import type { BranchComparison } from "../../shared/contracts/model/index";

interface GitBranchSelectionPanelProps {
  readonly activeRef: Ref | null;
  readonly actionsRef: RefObject<HTMLDivElement | null>;
  readonly busy: boolean;
  readonly canCompare: boolean;
  readonly canOperate: boolean;
  readonly comparison: BranchComparison | null;
  readonly currentBranch?: string | null;
  readonly detailsOpen: boolean;
  readonly remoteCount: number;
  readonly onAddWorktree: () => Promise<void>;
  readonly onCheckout: () => Promise<void>;
  readonly onCompare: () => Promise<void>;
  readonly onCreateBranch: () => Promise<void>;
  readonly onCreateTag: () => Promise<void>;
  readonly onDelete: () => Promise<void>;
  readonly onMerge: () => Promise<void>;
  readonly onPushTag: () => Promise<void>;
  readonly onRename: () => Promise<void>;
  readonly onSetUpstream: () => Promise<void>;
}

function BranchAction({
  children,
  disabled,
  onRun,
}: {
  readonly children: ReactNode;
  readonly disabled: boolean;
  readonly onRun: () => Promise<void>;
}) {
  return (
    <Button
      className={cn(
        "min-h-[25px] gap-1.5 px-1.5 text-xs text-muted-foreground",
      )}
      disabled={disabled}
      onClick={() => void onRun()}
      size="default"
      type="button"
      variant="ghost"
    >
      {children}
    </Button>
  );
}

export function GitBranchSelectionPanel({
  activeRef,
  actionsRef,
  busy,
  canCompare,
  canOperate,
  comparison,
  currentBranch,
  detailsOpen,
  remoteCount,
  onAddWorktree,
  onCheckout,
  onCompare,
  onCreateBranch,
  onCreateTag,
  onDelete,
  onMerge,
  onPushTag,
  onRename,
  onSetUpstream,
}: GitBranchSelectionPanelProps) {
  if (!activeRef) return null;
  return (
    <>
      {detailsOpen && (
        <div
          aria-label={`Actions for ${activeRef.shortName}`}
          className="gitBranchSelectedActions flex flex-wrap gap-[3px] border-t border-border px-[5px] py-1 [&_button]:h-[25px] [&_button]:bg-transparent [&_button]:px-1.5 [&_button]:text-[10px]"
          ref={actionsRef}
        >
          <BranchAction disabled={activeRef.current || busy} onRun={onCheckout}>
            Checkout
          </BranchAction>
          <BranchAction disabled={busy} onRun={onCreateBranch}>
            New Branch from…
          </BranchAction>
          <BranchAction
            disabled={
              !canCompare || !currentBranch || activeRef.current || busy
            }
            onRun={onCompare}
          >
            Compare
          </BranchAction>
          <BranchAction
            disabled={
              !currentBranch || activeRef.current || busy || !canOperate
            }
            onRun={onMerge}
          >
            Merge into {currentBranch ?? "current branch"}…
          </BranchAction>
          {activeRef.kind === "local" && (
            <BranchAction disabled={busy} onRun={onRename}>
              Rename…
            </BranchAction>
          )}
          {activeRef.kind === "local" && (
            <BranchAction disabled={busy} onRun={onSetUpstream}>
              Set Upstream…
            </BranchAction>
          )}
          <BranchAction disabled={busy || !canOperate} onRun={onCreateTag}>
            New Tag…
          </BranchAction>
          {activeRef.kind === "tag" && (
            <BranchAction
              disabled={busy || remoteCount === 0}
              onRun={onPushTag}
            >
              Push Tag
            </BranchAction>
          )}
          <BranchAction disabled={busy || !canOperate} onRun={onAddWorktree}>
            New Worktree…
          </BranchAction>
          <BranchAction
            disabled={activeRef.current || busy || !canOperate}
            onRun={onDelete}
          >
            Delete…
          </BranchAction>
        </div>
      )}
      {comparison && (
        <div
          className="gitBranchComparison flex items-center gap-2 border-t border-border bg-muted px-2 py-[5px] text-[10px] [&_span]:text-muted-foreground"
          role="status"
        >
          <strong>
            {currentBranch} ↔ {activeRef.shortName}
          </strong>
          <span>
            {comparison.ahead} ahead · {comparison.behind} behind
          </span>
        </div>
      )}
    </>
  );
}
