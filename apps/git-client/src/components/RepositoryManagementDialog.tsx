import { useState } from "react";
import type { Ref } from "../domain/types";
import type { ManagementSection } from "../domain/workspacePersistence";
import { toVoidHandler } from "../domain/toVoidHandler";
import type {
    BranchComparison,
    GitOperation,
    MultiRootOutcome,
    MultiRootResult,
    MultiRootRollbackStep,
    RemoteInfo,
    RepositorySnapshot,
    WorktreeInfo,
    GitConfig,
    IgnoreRules,
    SubmoduleInfo,
} from "../generated";
import { Icon } from "./Icon";
import { HostingPanel } from "./HostingPanel";
import { useAppDialog } from "./AppDialog";
import { RepositorySettingsPanel } from "./RepositorySettingsPanel";
import { RefManagementPanel } from "./RefManagementPanel";
import { tw } from "../styles/tailwind";

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
    onLoadConfig,
    onLoadSubmodules,
    onReadIgnoreRules,
    onWriteIgnoreRules,
    refs,
    onCompareBranches,
    onLoadMergedBranches,
    onOpenPush,
    onClose,
    embedded = false,
    section,
    onSectionChange,
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
    readonly onLoadConfig: () => Promise<readonly GitConfig[]>;
    readonly onLoadSubmodules: () => Promise<readonly SubmoduleInfo[]>;
    readonly onReadIgnoreRules: () => Promise<IgnoreRules>;
    readonly onWriteIgnoreRules: (rules: IgnoreRules) => Promise<void>;
    readonly refs: readonly Ref[];
    readonly onCompareBranches: (
        left: string,
        right: string,
    ) => Promise<BranchComparison>;
    readonly onLoadMergedBranches: (
        target: string,
    ) => Promise<readonly string[]>;
    readonly onOpenPush: () => void;
    readonly onClose?: () => void;
    readonly embedded?: boolean;
    readonly section: ManagementSection;
    readonly onSectionChange: (section: ManagementSection) => void;
}) {
    const tab = section;
    const [selectedRoots, setSelectedRoots] = useState<ReadonlySet<string>>(
        new Set(currentRepositoryId ? [currentRepositoryId] : []),
    );
    const [multiRootResult, setMultiRootResult] = useState<MultiRootResult>();
    const dialog = useAppDialog();
    const currentRepository = openRepositories.find(
        (repository) => repository.id === currentRepositoryId,
    );
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
            className={embedded ? tw.embeddedManagement : tw.dialogBackdrop}
            role="presentation"
        >
            <section
                className={tw.managementDialog}
                role={embedded ? "region" : "dialog"}
                aria-modal={embedded ? undefined : "true"}
                aria-label="Repository Management"
            >
                <header>
                    <Icon
                        name={
                            tab === "roots"
                                ? "folder"
                                : tab === "refs"
                                  ? "branch"
                                  : tab === "remotes"
                                    ? "remote"
                                    : tab === "worktrees"
                                      ? "worktree"
                                      : tab === "hosting"
                                        ? "globe"
                                        : "settings"
                        }
                        size={16}
                    />
                    <strong>Repository Management</strong>
                    <span />
                    {onClose && (
                        <button
                            className={tw.iconButton}
                            aria-label="Close management"
                            onClick={onClose}
                        >
                            <Icon name="close" size={15} />
                        </button>
                    )}
                </header>
                <aside>
                    <button
                        className={
                            tab === "roots" ? tw.activeButton : undefined
                        }
                        onClick={() => onSectionChange("roots")}
                    >
                        <Icon name="folder" size={15} /> Repository Roots
                    </button>
                    <button
                        className={tab === "refs" ? tw.activeButton : undefined}
                        onClick={() => onSectionChange("refs")}
                    >
                        <Icon name="branch" size={15} /> Branches & Tags
                    </button>
                    <button
                        className={
                            tab === "remotes" ? tw.activeButton : undefined
                        }
                        onClick={() => onSectionChange("remotes")}
                    >
                        <Icon name="remote" size={15} /> Remotes
                    </button>
                    <button
                        className={
                            tab === "worktrees" ? tw.activeButton : undefined
                        }
                        onClick={() => onSectionChange("worktrees")}
                    >
                        <Icon name="worktree" size={15} /> Worktrees
                    </button>
                    <button
                        className={
                            tab === "hosting" ? tw.activeButton : undefined
                        }
                        onClick={() => onSectionChange("hosting")}
                    >
                        <Icon name="globe" size={15} /> GitHub / GitLab
                    </button>
                    <button
                        className={
                            tab === "settings" ? tw.activeButton : undefined
                        }
                        onClick={() => onSectionChange("settings")}
                    >
                        <Icon name="settings" size={15} /> Config & Ignore
                    </button>
                </aside>
                <main>
                    {tab === "roots" ? (
                        <>
                            <div className={tw.managementToolbar}>
                                <strong>Multi-root Session</strong>
                                <span />
                                <button onClick={() => void onAddRoot()}>
                                    <Icon name="plus" size={13} /> Add
                                    repository
                                </button>
                                <button
                                    disabled={selectedRoots.size < 2}
                                    onClick={toVoidHandler(async () => {
                                        const target = await dialog.input({
                                            title: "Synchronized checkout",
                                            label: "Branch or revision",
                                            description: `Checks out the same target in ${selectedRoots.size} repositories.`,
                                        });
                                        if (!target) return;
                                        void onSynchronizedOperation(
                                            [...selectedRoots],
                                            {
                                                kind: "checkout",
                                                target,
                                                force: false,
                                            },
                                        ).then(setMultiRootResult);
                                    })}
                                >
                                    Sync checkout
                                </button>
                                <button
                                    disabled={selectedRoots.size < 2}
                                    onClick={toVoidHandler(async () => {
                                        const name = await dialog.input({
                                            title: "Create synchronized branch",
                                            label: "Branch name",
                                            initialValue: "feat/",
                                            description: `Creates and checks out the branch in ${selectedRoots.size} repositories.`,
                                        });
                                        if (!name) return;
                                        void onSynchronizedOperation(
                                            [...selectedRoots],
                                            {
                                                kind: "createBranch",
                                                name,
                                                startPoint: "HEAD",
                                                checkout: true,
                                            },
                                        ).then(setMultiRootResult);
                                    })}
                                >
                                    Sync new branch
                                </button>
                            </div>
                            {openRepositories.map((repository) => (
                                <article
                                    className={tw.managementRow}
                                    key={repository.id}
                                >
                                    <input
                                        aria-label={`Synchronize ${repository.name}`}
                                        checked={selectedRoots.has(
                                            repository.id,
                                        )}
                                        onChange={() =>
                                            toggleRoot(repository.id)
                                        }
                                        type="checkbox"
                                    />
                                    <Icon name="folder" size={18} />
                                    <div>
                                        <strong>{repository.name}</strong>
                                        <small>{repository.path}</small>
                                        <small>
                                            {repository.currentBranch ??
                                                "Detached HEAD"}{" "}
                                            ·{" "}
                                            {repository.headOid?.slice(0, 10) ??
                                                "empty"}
                                        </small>
                                    </div>
                                    <button
                                        disabled={
                                            repository.id ===
                                            currentRepositoryId
                                        }
                                        onClick={() =>
                                            void onSwitchRepository(
                                                repository.id,
                                            )
                                        }
                                    >
                                        {repository.id === currentRepositoryId
                                            ? "Active"
                                            : "Switch"}
                                    </button>
                                </article>
                            ))}
                            {multiRootResult && (
                                <section className={tw.rollbackPlan}>
                                    <header>
                                        <strong>Multi-root result</strong>
                                        <span />
                                        {multiRootResult.outcomes.some(
                                            (outcome) => !outcome.succeeded,
                                        ) &&
                                            multiRootResult.rollbackPlan
                                                .length > 0 && (
                                                <button
                                                    onClick={() =>
                                                        void onRollback(
                                                            multiRootResult.rollbackPlan,
                                                        ).then((outcomes) =>
                                                            setMultiRootResult({
                                                                outcomes: [
                                                                    ...outcomes,
                                                                ],
                                                                rollbackPlan:
                                                                    [],
                                                            }),
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
                                                className={
                                                    outcome.succeeded
                                                        ? tw.statusAdded
                                                        : tw.statusConflict
                                                }
                                            >
                                                {outcome.succeeded ? "✓" : "!"}
                                            </span>
                                            <code>{outcome.path}</code> ·{" "}
                                            {outcome.message}
                                        </p>
                                    ))}
                                    {multiRootResult.outcomes.some(
                                        (outcome) => !outcome.succeeded,
                                    ) &&
                                        multiRootResult.rollbackPlan.map(
                                            (step) => (
                                                <p key={step.repositoryId}>
                                                    Rollback ·{" "}
                                                    <code>{step.path}</code> ·{" "}
                                                    {step.description}
                                                </p>
                                            ),
                                        )}
                                </section>
                            )}
                        </>
                    ) : tab === "refs" ? (
                        <RefManagementPanel
                            currentBranch={
                                currentRepository?.currentBranch ?? undefined
                            }
                            onCompare={onCompareBranches}
                            onOperation={onOperation}
                            onLoadMergedBranches={onLoadMergedBranches}
                            onOpenPush={onOpenPush}
                            refs={refs}
                            remotes={remotes}
                        />
                    ) : tab === "remotes" ? (
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
                                            description:
                                                "This URL will be written to the repository Git config.",
                                        });
                                        if (url)
                                            void onOperation({
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
                                <article
                                    className={tw.managementRow}
                                    key={remote.name}
                                >
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
                                                description:
                                                    "Updates the fetch and default push destination.",
                                            });
                                            if (url)
                                                void onOperation({
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
                                            const accepted =
                                                await dialog.confirm({
                                                    title: `Remove remote “${remote.name}”?`,
                                                    description:
                                                        "Local remote-tracking references remain until pruned.",
                                                    impact: remote.fetchUrl,
                                                    confirmLabel:
                                                        "Remove remote",
                                                    dangerous: true,
                                                });
                                            if (!accepted) return;
                                            void onOperation({
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
                    ) : tab === "worktrees" ? (
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
                                            description:
                                                "Leave empty to use the selected start point without creating a branch.",
                                        });
                                        if (branch === null) return;
                                        const startPoint = await dialog.input({
                                            title: "Add worktree",
                                            label: "Start point",
                                            initialValue: "HEAD",
                                        });
                                        if (!startPoint) return;
                                        void onOperation({
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
                                <article
                                    className={tw.managementRow}
                                    key={worktree.path}
                                >
                                    <Icon name="worktree" size={18} />
                                    <div>
                                        <strong>
                                            {worktree.branch ??
                                                (worktree.detached
                                                    ? "Detached HEAD"
                                                    : "Bare")}
                                        </strong>
                                        <small>{worktree.path}</small>
                                        <small>
                                            {worktree.headOid?.slice(0, 10) ??
                                                "No HEAD"}
                                            {worktree.locked ? " · locked" : ""}
                                            {worktree.prunable
                                                ? " · prunable"
                                                : ""}
                                            {worktree.isMain
                                                ? " · main worktree"
                                                : ""}
                                        </small>
                                    </div>
                                    <button
                                        onClick={() =>
                                            void onOpenWorktree(worktree.path)
                                        }
                                    >
                                        Open
                                    </button>
                                    <button
                                        disabled={worktree.isMain}
                                        onClick={toVoidHandler(async () => {
                                            const impact = [
                                                `Path: ${worktree.path}`,
                                                `Branch: ${worktree.branch ?? "detached"}`,
                                                `HEAD: ${worktree.headOid ?? "none"}`,
                                            ].join("\n");
                                            const accepted =
                                                await dialog.confirm({
                                                    title: "Remove this worktree?",
                                                    description:
                                                        "The worktree directory and its administrative entry will be removed.",
                                                    impact,
                                                    confirmLabel:
                                                        "Remove worktree",
                                                    dangerous: true,
                                                });
                                            if (!accepted) return;
                                            void onOperation({
                                                kind: "worktreeRemove",
                                                path: worktree.path,
                                                force:
                                                    worktree.locked ||
                                                    worktree.prunable,
                                            });
                                        })}
                                    >
                                        Remove
                                    </button>
                                </article>
                            ))}
                        </>
                    ) : tab === "hosting" ? (
                        <HostingPanel
                            currentBranch={
                                currentRepository?.currentBranch ?? undefined
                            }
                            remoteUrl={
                                currentRepository?.remoteUrl ??
                                remotes[0]?.fetchUrl
                            }
                        />
                    ) : (
                        <RepositorySettingsPanel
                            isShallow={currentRepository?.isShallow ?? false}
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
