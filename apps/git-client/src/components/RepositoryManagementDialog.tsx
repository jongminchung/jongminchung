import { useState } from "react";
import type {
  GitOperation,
  MultiRootOutcome,
  MultiRootResult,
  MultiRootRollbackStep,
  RemoteInfo,
  RepositorySnapshot,
  WorktreeInfo,
} from "../generated";
import { Icon } from "./Icon";
import styles from "../styles/App.module.css";

export function RepositoryManagementDialog({
  remotes,
  worktrees,
  onOperation,
  onOpenWorktree,
  openRepositories,
  currentRepositoryId,
  onSwitchRepository,
  onAddRoot,
  onSynchronizedOperation,
  onRollback,
  onClose,
  embedded = false,
}: {
  readonly remotes: readonly RemoteInfo[];
  readonly worktrees: readonly WorktreeInfo[];
  readonly onOperation: (operation: GitOperation) => Promise<void>;
  readonly onOpenWorktree: (path: string) => Promise<void>;
  readonly openRepositories: readonly RepositorySnapshot[];
  readonly currentRepositoryId: string | null;
  readonly onSwitchRepository: (repositoryId: string) => Promise<void>;
  readonly onAddRoot: () => Promise<void>;
  readonly onSynchronizedOperation: (
    repositoryIds: readonly string[],
    operation: GitOperation,
  ) => Promise<MultiRootResult>;
  readonly onRollback: (
    steps: readonly MultiRootRollbackStep[],
  ) => Promise<readonly MultiRootOutcome[]>;
  readonly onClose?: () => void;
  readonly embedded?: boolean;
}) {
  const [tab, setTab] = useState<"roots" | "remotes" | "worktrees">("roots");
  const [selectedRoots, setSelectedRoots] = useState<ReadonlySet<string>>(
    new Set(currentRepositoryId ? [currentRepositoryId] : []),
  );
  const [multiRootResult, setMultiRootResult] = useState<MultiRootResult>();
  const toggleRoot = (repositoryId: string) => {
    setSelectedRoots((current) => {
      const next = new Set(current);
      if (next.has(repositoryId)) next.delete(repositoryId);
      else next.add(repositoryId);
      return next;
    });
  };
  return (
    <div
      className={embedded ? styles.embeddedManagement : styles.dialogBackdrop}
      role="presentation"
    >
      <section
        className={styles.managementDialog}
        role={embedded ? "region" : "dialog"}
        aria-modal={embedded ? undefined : "true"}
        aria-label="Repository Management"
      >
        <header>
          <Icon
            name={tab === "roots" ? "folder" : tab === "remotes" ? "remote" : "worktree"}
            size={16}
          />
          <strong>Repository Management</strong>
          <span />
          {onClose && (
            <button className={styles.iconButton} aria-label="Close management" onClick={onClose}>
              <Icon name="close" size={15} />
            </button>
          )}
        </header>
        <aside>
          <button
            className={tab === "roots" ? styles.activeButton : undefined}
            onClick={() => setTab("roots")}
          >
            <Icon name="folder" size={15} /> Repository Roots
          </button>
          <button
            className={tab === "remotes" ? styles.activeButton : undefined}
            onClick={() => setTab("remotes")}
          >
            <Icon name="remote" size={15} /> Remotes
          </button>
          <button
            className={tab === "worktrees" ? styles.activeButton : undefined}
            onClick={() => setTab("worktrees")}
          >
            <Icon name="worktree" size={15} /> Worktrees
          </button>
        </aside>
        <main>
          {tab === "roots" ? (
            <>
              <div className={styles.managementToolbar}>
                <strong>Multi-root Session</strong>
                <span />
                <button onClick={() => void onAddRoot()}>
                  <Icon name="plus" size={13} /> Add repository
                </button>
                <button
                  disabled={selectedRoots.size < 2}
                  onClick={() => {
                    const target = window.prompt("Branch or revision to check out")?.trim();
                    if (!target) return;
                    void onSynchronizedOperation([...selectedRoots], {
                      kind: "checkout",
                      target,
                      force: false,
                    }).then(setMultiRootResult);
                  }}
                >
                  Sync checkout
                </button>
                <button
                  disabled={selectedRoots.size < 2}
                  onClick={() => {
                    const name = window.prompt("New synchronized branch", "feat/")?.trim();
                    if (!name) return;
                    void onSynchronizedOperation([...selectedRoots], {
                      kind: "createBranch",
                      name,
                      startPoint: "HEAD",
                      checkout: true,
                    }).then(setMultiRootResult);
                  }}
                >
                  Sync new branch
                </button>
              </div>
              {openRepositories.map((repository) => (
                <article className={styles.managementRow} key={repository.id}>
                  <input
                    aria-label={`Synchronize ${repository.name}`}
                    checked={selectedRoots.has(repository.id)}
                    onChange={() => toggleRoot(repository.id)}
                    type="checkbox"
                  />
                  <Icon name="folder" size={18} />
                  <div>
                    <strong>{repository.name}</strong>
                    <small>{repository.path}</small>
                    <small>
                      {repository.currentBranch ?? "Detached HEAD"} ·{" "}
                      {repository.headOid?.slice(0, 10) ?? "empty"}
                    </small>
                  </div>
                  <button
                    disabled={repository.id === currentRepositoryId}
                    onClick={() => void onSwitchRepository(repository.id)}
                  >
                    {repository.id === currentRepositoryId ? "Active" : "Switch"}
                  </button>
                </article>
              ))}
              {multiRootResult && (
                <section className={styles.rollbackPlan}>
                  <header>
                    <strong>Multi-root result</strong>
                    <span />
                    {multiRootResult.outcomes.some((outcome) => !outcome.succeeded) &&
                      multiRootResult.rollbackPlan.length > 0 && (
                        <button
                          onClick={() =>
                            void onRollback(multiRootResult.rollbackPlan).then((outcomes) =>
                              setMultiRootResult({ outcomes: [...outcomes], rollbackPlan: [] }),
                            )
                          }
                        >
                          Apply rollback plan
                        </button>
                      )}
                  </header>
                  {multiRootResult.outcomes.map((outcome) => (
                    <p key={outcome.repositoryId}>
                      <span
                        className={outcome.succeeded ? styles.statusAdded : styles.statusConflict}
                      >
                        {outcome.succeeded ? "✓" : "!"}
                      </span>
                      <code>{outcome.path}</code> · {outcome.message}
                    </p>
                  ))}
                  {multiRootResult.outcomes.some((outcome) => !outcome.succeeded) &&
                    multiRootResult.rollbackPlan.map((step) => (
                      <p key={step.repositoryId}>
                        Rollback · <code>{step.path}</code> · {step.description}
                      </p>
                    ))}
                </section>
              )}
            </>
          ) : tab === "remotes" ? (
            <>
              <div className={styles.managementToolbar}>
                <strong>Remotes</strong>
                <span />
                <button
                  onClick={() => {
                    const name = window.prompt("Remote name", "origin")?.trim();
                    if (!name) return;
                    const url = window.prompt("Remote URL", "git@github.com:")?.trim();
                    if (url) void onOperation({ kind: "remoteAdd", name, url });
                  }}
                >
                  <Icon name="plus" size={13} /> Add remote
                </button>
              </div>
              {remotes.map((remote) => (
                <article className={styles.managementRow} key={remote.name}>
                  <Icon name="remote" size={18} />
                  <div>
                    <strong>{remote.name}</strong>
                    <small>Fetch · {remote.fetchUrl}</small>
                    <small>Push · {remote.pushUrl}</small>
                  </div>
                  <button
                    onClick={() => {
                      const url = window.prompt(`URL for ${remote.name}`, remote.fetchUrl)?.trim();
                      if (url) void onOperation({ kind: "remoteSetUrl", name: remote.name, url });
                    }}
                  >
                    Edit URL
                  </button>
                  <button
                    onClick={() => {
                      if (!window.confirm(`Remove remote “${remote.name}”?\n\n${remote.fetchUrl}`))
                        return;
                      void onOperation({ kind: "remoteRemove", name: remote.name });
                    }}
                  >
                    Remove
                  </button>
                </article>
              ))}
            </>
          ) : (
            <>
              <div className={styles.managementToolbar}>
                <strong>Worktrees</strong>
                <span />
                <button
                  onClick={() => {
                    const path = window.prompt("Absolute worktree path")?.trim();
                    if (!path) return;
                    const branch = window.prompt("New branch (optional)")?.trim() || null;
                    const startPoint = window.prompt("Start point", "HEAD")?.trim() || null;
                    void onOperation({ kind: "worktreeAdd", path, branch, startPoint });
                  }}
                >
                  <Icon name="plus" size={13} /> Add worktree
                </button>
              </div>
              {worktrees.map((worktree) => (
                <article className={styles.managementRow} key={worktree.path}>
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
                    onClick={() => {
                      const impact = [
                        `Path: ${worktree.path}`,
                        `Branch: ${worktree.branch ?? "detached"}`,
                        `HEAD: ${worktree.headOid ?? "none"}`,
                      ].join("\n");
                      if (!window.confirm(`Remove this worktree?\n\n${impact}`)) return;
                      void onOperation({
                        kind: "worktreeRemove",
                        path: worktree.path,
                        force: worktree.locked || worktree.prunable,
                      });
                    }}
                  >
                    Remove
                  </button>
                </article>
              ))}
            </>
          )}
        </main>
      </section>
    </div>
  );
}
