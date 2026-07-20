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
import { tw } from "../styles/tailwind";
import { useAppDialog } from "./AppDialog";
import { HostingPanel } from "./HostingPanel";
import { Icon } from "./Icon";
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
    <div className={tw.dialogBackdrop} role="presentation">
      <section
        aria-label={presentation.title}
        aria-modal="true"
        className={tw.repositoryToolDialog}
        role="dialog"
      >
        <header>
          <Icon name={presentation.icon} size={16} />
          <strong>{presentation.title}</strong>
          <span />
          <button
            aria-label={`Close ${presentation.title}`}
            className={tw.iconButton}
            onClick={onClose}
          >
            <Icon name="close" size={15} />
          </button>
        </header>
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
              <div className={tw.managementToolbar}>
                <strong>Remotes</strong>
                <span />
                <button
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
                >
                  <Icon name="plus" size={13} /> Add remote
                </button>
              </div>
              {remotes.map((remote) => (
                <article className={tw.managementRow} key={remote.name}>
                  <Icon name="remote" size={18} />
                  <div>
                    <strong>{remote.name}</strong>
                    <small>Fetch · {remote.fetchUrl}</small>
                    <small>Push · {remote.pushUrl}</small>
                  </div>
                  <button
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
                  >
                    Edit URL
                  </button>
                  <button
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
                  >
                    Remove
                  </button>
                </article>
              ))}
            </>
          ) : kind === "worktrees" ? (
            <>
              <div className={tw.managementToolbar}>
                <strong>Worktrees</strong>
                <span />
                <button
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
                >
                  <Icon name="plus" size={13} /> Add worktree
                </button>
              </div>
              {worktrees.map((worktree) => (
                <article className={tw.managementRow} key={worktree.path}>
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
                  <button onClick={() => void onOpenWorktree(worktree.path)}>Open</button>
                  <button
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
                  >
                    Remove
                  </button>
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
      </section>
      {dialog.node}
    </div>
  );
}
