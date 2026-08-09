import { Button } from "@jongminchung/ui/components/button";
import { cn } from "@jongminchung/ui/lib/utils";
import { toVoidHandler } from "../domain/toVoidHandler";
import type { Ref } from "../domain/types";
import type {
  BranchComparison,
  GitConfig,
  GitOperation,
  IgnoreRules,
  RemoteInfo,
  RepositorySnapshot,
  SubmoduleInfo,
  WorktreeInfo,
} from "../shared/contracts/model";
import { useAppDialog } from "./AppDialog";
import { HostingPanel } from "./HostingPanel";
import { Icon } from "./Icon";
import { Dialog, DialogHeader } from "./ProductDialog";
import { RefManagementPanel } from "./RefManagementPanel";
import { RepositorySettingsPanel } from "./RepositorySettingsPanel";

export type RepositoryToolKind = "refs" | "remotes" | "worktrees" | "hosting" | "settings";

const TOOL_PRESENTATION = {
  refs: { icon: "branch", title: "Branches & Tags" },
  remotes: { icon: "remote", title: "Git Remotes" },
  worktrees: { icon: "worktree", title: "Git Worktrees" },
  hosting: { icon: "globe", title: "GitHub / GitLab" },
  settings: { icon: "settings", title: "Repository Settings" },
} as const;

export function RepositoryToolDialog({
  kind,
  onClose,
  onCompareBranches,
  onLoadConfig,
  onLoadMergedBranches,
  onLoadSubmodules,
  onOpenPush,
  onOpenWorktree,
  onOperation,
  onReadIgnoreRules,
  onWriteIgnoreRules,
  refs,
  remotes,
  repository,
  worktrees,
}: {
  readonly kind: RepositoryToolKind;
  readonly onClose: () => void;
  readonly onCompareBranches: (left: string, right: string) => Promise<BranchComparison>;
  readonly onLoadConfig: () => Promise<readonly GitConfig[]>;
  readonly onLoadMergedBranches: (target: string) => Promise<readonly string[]>;
  readonly onLoadSubmodules: () => Promise<readonly SubmoduleInfo[]>;
  readonly onOpenPush: () => void;
  readonly onOpenWorktree: (path: string) => Promise<void>;
  readonly onOperation: (operation: GitOperation) => Promise<void>;
  readonly onReadIgnoreRules: () => Promise<IgnoreRules>;
  readonly onWriteIgnoreRules: (rules: IgnoreRules) => Promise<void>;
  readonly refs: readonly Ref[];
  readonly remotes: readonly RemoteInfo[];
  readonly repository: RepositorySnapshot;
  readonly worktrees: readonly WorktreeInfo[];
}) {
  const dialog = useAppDialog();
  const presentation = TOOL_PRESENTATION[kind];

  return (
    <>
      <Dialog
        aria-label={presentation.title}
        className="grid h-[min(680px,calc(100vh-70px))] grid-rows-[44px_minmax(0,1fr)] overflow-hidden border-input bg-secondary [&>header]:flex [&>header]:items-center [&>header]:gap-2 [&>header]:border-b [&>header]:border-border [&>header]:px-[9px] [&>main]:min-h-0 [&>main]:overflow-auto"
        isOpen
        maxHeight="calc(100vh - 70px)"
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
        padding={0}
        purpose="info"
        width="min(980px, calc(100vw - 70px))"
      >
        <DialogHeader
          closeLabel={`Close ${presentation.title}`}
          icon={<Icon name={presentation.icon} size={16} />}
          onOpenChange={() => onClose()}
          title={presentation.title}
        />
        <main>
          {kind === "refs" ? (
            <RefManagementPanel
              currentBranch={repository.currentBranch ?? undefined}
              onCompare={onCompareBranches}
              onLoadMergedBranches={onLoadMergedBranches}
              onOpenPush={onOpenPush}
              onOperation={onOperation}
              refs={refs}
              remotes={remotes}
            />
          ) : kind === "remotes" ? (
            <>
              <div
                className={`managementToolbar [&>_span]:[flex:1] [align-items:center] [background:var(--muted)] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:5px] [height:38px] [padding:0_11px] [&>_button]:[align-items:center] [&>_button]:[background:var(--card)] [&>_button]:[border:1px_solid_var(--border)] [&>_button]:rounded-sm [&>_button]:[display:flex] [&>_button]:[gap:5px] [&>_button]:[min-height:27px] [&>_button]:[padding:0_8px] [background:var(--card)] managementToolbar [&>_button]:rounded-sm`}
              >
                <strong>Remotes</strong>
                <span />
                <Button
                  onClick={toVoidHandler(async () => {
                    const name = await dialog.input({
                      title: "Add remote",
                      label: "Remote name",
                      initialValue: "origin",
                    });
                    if (!name) return;
                    const url = await dialog.input({
                      title: `Add remote “${name}”`,
                      label: "Remote URL",
                      initialValue: "git@github.com:",
                    });
                    if (!url) return;
                    await onOperation({
                      kind: "remoteAdd",
                      name,
                      url,
                    });
                  })}
                  type="button"
                  className={cn("h-7 px-2.5")}
                  variant="outline"
                  size="sm"
                >
                  <Icon name="plus" size={13} /> Add remote
                </Button>
              </div>
              {remotes.map((remote) => (
                <article
                  className={`managementRow [&>_button]:[align-items:center] [&>_button]:[background:var(--card)] [&>_button]:[border:1px_solid_var(--border)] [&>_button]:rounded-sm [&>_button]:[display:flex] [&>_button]:[gap:5px] [&>_button]:[min-height:27px] [&>_button]:[padding:0_8px] [align-items:center] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:9px] [min-height:66px] [padding:8px_11px] [&>_div]:[flex:1] [&>_div]:[min-width:0] [&_small]:[color:var(--disabled-foreground)] [&_small]:[display:block] [&_small]:[margin-top:2px] [&_small]:[overflow:hidden] [&_small]:[text-overflow:ellipsis] [&_small]:[white-space:nowrap] managementRow [&>_button]:rounded-sm`}
                  key={remote.name}
                >
                  <Icon name="remote" size={18} />
                  <div>
                    <strong>{remote.name}</strong>
                    <small>Fetch · {remote.fetchUrl}</small>
                    <small>Push · {remote.pushUrl}</small>
                  </div>
                  <Button
                    onClick={toVoidHandler(async () => {
                      const url = await dialog.input({
                        title: `Edit ${remote.name}`,
                        label: "Remote URL",
                        initialValue: remote.fetchUrl,
                      });
                      if (url)
                        await onOperation({
                          kind: "remoteSetUrl",
                          name: remote.name,
                          url,
                        });
                    })}
                    type="button"
                    className={cn("h-7 px-2.5")}
                    variant="outline"
                    size="sm"
                  >
                    Edit URL
                  </Button>
                  <Button
                    onClick={toVoidHandler(async () => {
                      const accepted = await dialog.confirm({
                        title: `Remove remote “${remote.name}”?`,
                        description: "Local remote-tracking references remain until pruned.",
                        impact: remote.fetchUrl,
                        confirmLabel: "Remove remote",
                        dangerous: true,
                      });
                      if (accepted)
                        await onOperation({
                          kind: "remoteRemove",
                          name: remote.name,
                        });
                    })}
                    type="button"
                    className={cn("h-7 px-2.5")}
                    variant="outline"
                    size="sm"
                  >
                    Remove
                  </Button>
                </article>
              ))}
            </>
          ) : kind === "worktrees" ? (
            <>
              <div
                className={`managementToolbar [&>_span]:[flex:1] [align-items:center] [background:var(--muted)] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:5px] [height:38px] [padding:0_11px] [&>_button]:[align-items:center] [&>_button]:[background:var(--card)] [&>_button]:[border:1px_solid_var(--border)] [&>_button]:rounded-sm [&>_button]:[display:flex] [&>_button]:[gap:5px] [&>_button]:[min-height:27px] [&>_button]:[padding:0_8px] [background:var(--card)] managementToolbar [&>_button]:rounded-sm`}
              >
                <strong>Worktrees</strong>
                <span />
                <Button
                  onClick={toVoidHandler(async () => {
                    const path = await dialog.input({
                      title: "Add worktree",
                      label: "Absolute worktree path",
                    });
                    if (!path) return;
                    const branch = await dialog.input({
                      title: "Add worktree",
                      label: "New branch (optional)",
                      allowEmpty: true,
                    });
                    if (branch === null) return;
                    const startPoint = await dialog.input({
                      title: "Add worktree",
                      label: "Start point",
                      initialValue: "HEAD",
                    });
                    if (!startPoint) return;
                    await onOperation({
                      kind: "worktreeAdd",
                      path,
                      branch,
                      startPoint,
                    });
                  })}
                  type="button"
                  className={cn("h-7 px-2.5")}
                  variant="outline"
                  size="sm"
                >
                  <Icon name="plus" size={13} /> Add worktree
                </Button>
              </div>
              {worktrees.map((worktree) => (
                <article
                  className={`managementRow [&>_button]:[align-items:center] [&>_button]:[background:var(--card)] [&>_button]:[border:1px_solid_var(--border)] [&>_button]:rounded-sm [&>_button]:[display:flex] [&>_button]:[gap:5px] [&>_button]:[min-height:27px] [&>_button]:[padding:0_8px] [align-items:center] [border-bottom:1px_solid_var(--border)] [display:flex] [gap:9px] [min-height:66px] [padding:8px_11px] [&>_div]:[flex:1] [&>_div]:[min-width:0] [&_small]:[color:var(--disabled-foreground)] [&_small]:[display:block] [&_small]:[margin-top:2px] [&_small]:[overflow:hidden] [&_small]:[text-overflow:ellipsis] [&_small]:[white-space:nowrap] managementRow [&>_button]:rounded-sm`}
                  key={worktree.path}
                >
                  <Icon name="worktree" size={18} />
                  <div>
                    <strong>
                      {worktree.branch ?? (worktree.detached ? "Detached HEAD" : "Bare")}
                    </strong>
                    <small>{worktree.path}</small>
                    <small>
                      {worktree.headOid?.slice(0, 10) ?? "No HEAD"}
                      {worktree.locked ? " · locked" : ""}
                      {worktree.prunable ? " · prunable" : ""}
                      {worktree.isMain ? " · main worktree" : ""}
                    </small>
                  </div>
                  <Button
                    onClick={() => void onOpenWorktree(worktree.path)}
                    type="button"
                    className={cn("h-7 px-2.5")}
                    variant="outline"
                    size="sm"
                  >
                    Open
                  </Button>
                  <Button
                    disabled={worktree.isMain}
                    onClick={toVoidHandler(async () => {
                      const accepted = await dialog.confirm({
                        title: "Remove this worktree?",
                        description:
                          "The worktree directory and its administrative entry will be removed.",
                        impact: worktree.path,
                        confirmLabel: "Remove worktree",
                        dangerous: true,
                      });
                      if (accepted) {
                        await onOperation({
                          kind: "worktreeRemove",
                          path: worktree.path,
                          force: worktree.locked || worktree.prunable,
                        });
                      }
                    })}
                    type="button"
                    className={cn("h-7 px-2.5")}
                    variant="outline"
                    size="sm"
                  >
                    Remove
                  </Button>
                </article>
              ))}
            </>
          ) : kind === "hosting" ? (
            <HostingPanel
              currentBranch={repository.currentBranch ?? undefined}
              remoteUrl={repository.remoteUrl ?? remotes[0]?.fetchUrl}
            />
          ) : (
            <RepositorySettingsPanel
              isShallow={repository.isShallow}
              onLoadConfig={onLoadConfig}
              onLoadSubmodules={onLoadSubmodules}
              onOperation={onOperation}
              onReadIgnoreRules={onReadIgnoreRules}
              onWriteIgnoreRules={onWriteIgnoreRules}
            />
          )}
        </main>
      </Dialog>
      {dialog.node}
    </>
  );
}
