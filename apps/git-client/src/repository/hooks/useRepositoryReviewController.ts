import { useCallback, useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { AppDialogController } from "../../components/AppDialog";
import { deriveActionAvailability } from "../../domain/actionAvailability";
import {
    reconcileChangeSelection,
    type ChangeEntry,
    type DiffPreferences,
} from "../../domain/changeReview";
import { commitUrl } from "../../domain/forge";
import type {
    ActionAvailability,
    Commit,
    FileChange,
    RepositoryView,
} from "../../domain/types";
import type { GitSessionController } from "../../git-session/useGitSessionController";
import { isElectronRuntime } from "../../platform/electron";
import {
    openExternalUrl,
    selectPatchExportPath,
} from "../../platform/electronActions";
import type { DiffOptions, FileSource } from "../../shared/contracts/model";
import { useRepositoryWorkspaceStore } from "../state/RepositoryWorkspaceStoreProvider";
import type { InspectorState } from "../state/workspaceTypes";
import { useRepositoryContentLoader } from "./useRepositoryContentLoader";

const commitFilesCache = new Map<string, readonly FileChange[]>();
const COMMIT_FILES_CACHE_LIMIT = 200;
const EMPTY_TREE_OID = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

function nativeDiffOptions(preferences: DiffPreferences): DiffOptions {
    return {
        whitespace: preferences.whitespace,
        contextLines:
            preferences.contextLines === "full"
                ? null
                : preferences.contextLines,
    };
}

function cacheCommitFiles(key: string, files: readonly FileChange[]): void {
    commitFilesCache.delete(key);
    commitFilesCache.set(key, files);
    const oldest = commitFilesCache.keys().next().value;
    if (
        commitFilesCache.size > COMMIT_FILES_CACHE_LIMIT &&
        typeof oldest === "string"
    ) {
        commitFilesCache.delete(oldest);
    }
}

export function clearCommitFilesCache(): void {
    commitFilesCache.clear();
}

interface RepositoryReviewControllerOptions {
    readonly dialog: AppDialogController;
    readonly onOpenPush: (
        localRevision?: string,
        knownRewrite?: boolean,
    ) => void;
    readonly openInspector: (next: InspectorState, keepOpen?: boolean) => void;
    readonly repository: RepositoryView;
    readonly session: GitSessionController;
    readonly workingEntries: readonly ChangeEntry[];
}

export function useRepositoryReviewController({
    dialog,
    onOpenPush,
    openInspector,
    repository,
    session,
    workingEntries,
}: RepositoryReviewControllerOptions) {
    const { executeOperation } = session.mutations;
    const {
        createPatchText,
        exportPatch,
        loadCommitDiff,
        loadCommitFiles,
        loadCommitSignature,
        loadRevisionDiff,
        loadSubmoduleDiff,
        loadWorkingDiff,
        readFile,
        readFilePreview,
    } = session.queries;
    const { loading: sessionLoading } = session.repository;
    const {
        changeSelection,
        commitFiles,
        diffPreferences,
        historyParentRevision,
        historySelectedPath,
        selectedOids,
        setChangeDiff,
        setChangeSelection,
        setChangeSubmodule,
        setCommitFiles,
        setCommitFilesLoading,
        setCommitSignature,
        setContextPosition,
        setHistoryDiff,
        setHistoryParentRevision,
        setHistoryRewrite,
        setHistorySelectedPath,
        setHistorySubmodule,
        setRepositoryViewMode,
        setRevisionComparison,
        setSelectedOids,
        setToast,
    } = useRepositoryWorkspaceStore(
        useShallow((state) => ({
            changeSelection: state.changeSelection,
            commitFiles: state.commitFiles,
            diffPreferences: state.diffPreferences,
            historyParentRevision: state.historyParentRevision,
            historySelectedPath: state.historySelectedPath,
            selectedOids: state.selectedOids,
            setChangeDiff: state.setChangeDiff,
            setChangeSelection: state.setChangeSelection,
            setChangeSubmodule: state.setChangeSubmodule,
            setCommitFiles: state.setCommitFiles,
            setCommitFilesLoading: state.setCommitFilesLoading,
            setCommitSignature: state.setCommitSignature,
            setContextPosition: state.setContextPosition,
            setHistoryDiff: state.setHistoryDiff,
            setHistoryParentRevision: state.setHistoryParentRevision,
            setHistoryRewrite: state.setHistoryRewrite,
            setHistorySelectedPath: state.setHistorySelectedPath,
            setHistorySubmodule: state.setHistorySubmodule,
            setRepositoryViewMode: state.setRepositoryViewMode,
            setRevisionComparison: state.setRevisionComparison,
            setSelectedOids: state.setSelectedOids,
            setToast: state.setToast,
        })),
    );
    const commitsByOid = useMemo(
        () => new Map(repository.commits.map((commit) => [commit.oid, commit])),
        [repository.commits],
    );
    const selectedCommits = useMemo(
        () =>
            selectedOids
                .map((oid) => commitsByOid.get(oid))
                .filter((commit): commit is Commit => Boolean(commit)),
        [commitsByOid, selectedOids],
    );
    const primaryCommit = selectedCommits[0];
    const primaryCommitOid = primaryCommit?.oid;
    const primaryIndex = primaryCommit
        ? repository.commits.findIndex(
              (commit) => commit.oid === primaryCommit.oid,
          )
        : -1;
    const selectedInHistoryOrder = repository.commits.filter((commit) =>
        selectedOids.includes(commit.oid),
    );
    const selectedAreContiguousFirstParent =
        selectedInHistoryOrder.length === selectedOids.length &&
        selectedInHistoryOrder.every((commit, index) => {
            const older = selectedInHistoryOrder[index + 1];
            return !older || commit.parents[0] === older.oid;
        });
    const availability = useMemo(
        () =>
            deriveActionAvailability({
                selectedCommits,
                currentBranch: repository.snapshot.currentBranch ?? undefined,
                headOid: repository.snapshot.headOid ?? undefined,
                upstream: repository.snapshot.upstream ?? undefined,
                selectedIsAncestorOfHead: primaryIndex >= 0,
                selectedIsAheadOfUpstream:
                    primaryIndex >= 0 && primaryIndex < repository.status.ahead,
                selectedAreContiguousFirstParent,
                selectedIncludesMerge: selectedCommits.some(
                    (commit) => commit.parents.length > 1,
                ),
                hasChild: Boolean(
                    primaryCommit &&
                    repository.commits.some((commit) =>
                        commit.parents.includes(primaryCommit.oid),
                    ),
                ),
                repositoryHasCommits: repository.snapshot.hasCommits,
                operationInProgress: repository.snapshot.operation !== null,
            }),
        [
            primaryCommit,
            primaryIndex,
            repository.commits,
            repository.snapshot,
            repository.status.ahead,
            selectedCommits,
            selectedAreContiguousFirstParent,
        ],
    );

    useEffect(() => {
        if (sessionLoading || selectedOids.length === 0) return;
        const validOids = selectedOids.filter((oid) => commitsByOid.has(oid));
        if (validOids.length !== selectedOids.length)
            setSelectedOids(validOids);
    }, [commitsByOid, selectedOids, sessionLoading, setSelectedOids]);

    useEffect(() => {
        setChangeSelection((current) =>
            reconcileChangeSelection(current, workingEntries),
        );
    }, [setChangeSelection, workingEntries]);

    useEffect(() => {
        setHistoryParentRevision(
            primaryCommit?.parents[0] ??
                (primaryCommit ? EMPTY_TREE_OID : null),
        );
    }, [primaryCommit, setHistoryParentRevision]);

    useEffect(() => {
        if (!primaryCommitOid) {
            setCommitFiles([]);
            setCommitFilesLoading(false);
            return;
        }
        const cacheKey = `${repository.snapshot.id}:${primaryCommitOid}`;
        const cached = commitFilesCache.get(cacheKey);
        if (cached) {
            setCommitFiles(cached);
            setCommitFilesLoading(false);
            return;
        }
        let active = true;
        const load = async (): Promise<void> => {
            setCommitFilesLoading(true);
            try {
                const files = await loadCommitFiles(primaryCommitOid);
                if (active) {
                    cacheCommitFiles(cacheKey, files);
                    setCommitFiles(files);
                }
            } catch (error) {
                console.warn("Could not load commit files", error);
                if (active) setCommitFiles([]);
            } finally {
                if (active) setCommitFilesLoading(false);
            }
        };
        void load();
        return () => {
            active = false;
        };
    }, [
        primaryCommitOid,
        repository.snapshot.id,
        loadCommitFiles,
        setCommitFiles,
        setCommitFilesLoading,
    ]);

    useEffect(() => {
        setHistorySelectedPath((current) => {
            if (current && commitFiles.some((file) => file.path === current))
                return current;
            return commitFiles[0]?.path ?? null;
        });
    }, [commitFiles, setHistorySelectedPath]);

    useEffect(() => {
        const file = commitFiles.find(
            (candidate) => candidate.path === historySelectedPath,
        );
        if (
            !primaryCommit ||
            !file ||
            !historyParentRevision ||
            file.binary ||
            file.submodule
        ) {
            setHistoryDiff({ patch: "", loading: false });
            return;
        }
        let active = true;
        const load = async (): Promise<void> => {
            setHistoryDiff((current) => ({ ...current, loading: true }));
            try {
                const patch = await loadCommitDiff(
                    primaryCommit,
                    file.path,
                    nativeDiffOptions(diffPreferences),
                    historyParentRevision,
                );
                if (active) setHistoryDiff({ patch, loading: false });
            } catch (error) {
                if (active) {
                    setHistoryDiff({
                        patch: `Unable to load diff: ${String(error)}`,
                        loading: false,
                    });
                }
            }
        };
        void load();
        return () => {
            active = false;
        };
    }, [
        commitFiles,
        diffPreferences,
        historyParentRevision,
        historySelectedPath,
        primaryCommit,
        loadCommitDiff,
        setHistoryDiff,
    ]);

    useEffect(() => {
        const entry = workingEntries.find(
            (candidate) =>
                changeSelection?.path === candidate.selection.path &&
                changeSelection.layer === candidate.selection.layer,
        );
        if (
            !entry ||
            entry.file.status === "conflicted" ||
            entry.file.binary ||
            entry.file.submodule
        ) {
            setChangeDiff({ patch: "", loading: false });
            return;
        }
        let active = true;
        const load = async (): Promise<void> => {
            setChangeDiff((current) => ({ ...current, loading: true }));
            try {
                const patch = await loadWorkingDiff(
                    entry.file.path,
                    entry.selection.layer === "index",
                    nativeDiffOptions(diffPreferences),
                );
                if (active) setChangeDiff({ patch, loading: false });
            } catch (error) {
                if (active) {
                    setChangeDiff({
                        patch: `Unable to load diff: ${String(error)}`,
                        loading: false,
                    });
                }
            }
        };
        void load();
        return () => {
            active = false;
        };
    }, [
        changeSelection,
        diffPreferences,
        loadWorkingDiff,
        setChangeDiff,
        workingEntries,
    ]);

    useEffect(() => {
        const file = commitFiles.find(
            (candidate) => candidate.path === historySelectedPath,
        );
        if (!primaryCommit || !file?.submodule || !historyParentRevision) {
            setHistorySubmodule({ value: null, loading: false });
            return;
        }
        let active = true;
        setHistorySubmodule((current) => ({ ...current, loading: true }));
        void loadSubmoduleDiff(
            { kind: "revision", revision: historyParentRevision },
            { kind: "revision", revision: primaryCommit.oid },
            file.path,
        ).then(
            (value) => {
                if (active) setHistorySubmodule({ value, loading: false });
            },
            () => {
                if (active)
                    setHistorySubmodule({ value: null, loading: false });
            },
        );
        return () => {
            active = false;
        };
    }, [
        commitFiles,
        historyParentRevision,
        historySelectedPath,
        primaryCommit,
        loadSubmoduleDiff,
        setHistorySubmodule,
    ]);

    useEffect(() => {
        const entry = workingEntries.find(
            (candidate) =>
                changeSelection?.path === candidate.selection.path &&
                changeSelection.layer === candidate.selection.layer,
        );
        if (!entry?.file.submodule) {
            setChangeSubmodule({ value: null, loading: false });
            return;
        }
        const before: FileSource =
            entry.selection.layer === "index"
                ? {
                      kind: "revision",
                      revision: repository.snapshot.headOid ?? EMPTY_TREE_OID,
                  }
                : { kind: "index" };
        const after: FileSource =
            entry.selection.layer === "index"
                ? { kind: "index" }
                : { kind: "workingTree" };
        let active = true;
        setChangeSubmodule((current) => ({ ...current, loading: true }));
        void loadSubmoduleDiff(before, after, entry.file.path).then(
            (value) => {
                if (active) setChangeSubmodule({ value, loading: false });
            },
            () => {
                if (active) setChangeSubmodule({ value: null, loading: false });
            },
        );
        return () => {
            active = false;
        };
    }, [
        changeSelection,
        repository.snapshot.headOid,
        loadSubmoduleDiff,
        setChangeSubmodule,
        workingEntries,
    ]);

    useEffect(() => {
        if (!primaryCommitOid || !isElectronRuntime()) {
            setCommitSignature(undefined);
            return;
        }
        let active = true;
        void loadCommitSignature(primaryCommitOid).then(
            (signature) => active && setCommitSignature(signature),
            () => active && setCommitSignature(undefined),
        );
        return () => {
            active = false;
        };
    }, [loadCommitSignature, primaryCommitOid, setCommitSignature]);

    useEffect(() => {
        if (selectedCommits.length !== 2) {
            setRevisionComparison(undefined);
            return;
        }
        const [to, from] = selectedCommits;
        if (!from || !to) return;
        let active = true;
        setRevisionComparison({
            from: from.oid,
            to: to.oid,
            patch: "",
            loading: true,
        });
        void loadRevisionDiff(
            from.oid,
            to.oid,
            nativeDiffOptions(diffPreferences),
        ).then(
            (patch) => {
                if (active) {
                    setRevisionComparison({
                        from: from.oid,
                        to: to.oid,
                        patch,
                        loading: false,
                    });
                }
            },
            (error) => {
                if (active) {
                    setRevisionComparison({
                        from: from.oid,
                        to: to.oid,
                        patch: `Unable to compare revisions: ${String(error)}`,
                        loading: false,
                    });
                }
            },
        );
        return () => {
            active = false;
        };
    }, [
        diffPreferences,
        loadRevisionDiff,
        selectedCommits,
        setRevisionComparison,
    ]);

    useRepositoryContentLoader({
        loadFile: readFile,
        loadFilePreview: readFilePreview,
        primaryCommit,
        repository,
        workingEntries,
    });

    const selectRelative = useCallback(
        (direction: "parent" | "child"): void => {
            if (!primaryCommit) return;
            const oid =
                direction === "parent"
                    ? primaryCommit.parents[0]
                    : repository.commits.find((commit) =>
                          commit.parents.includes(primaryCommit.oid),
                      )?.oid;
            if (oid && commitsByOid.has(oid)) setSelectedOids([oid]);
        },
        [commitsByOid, primaryCommit, repository.commits, setSelectedOids],
    );

    const runAction = useCallback(
        async (action: keyof ActionAvailability): Promise<void> => {
            setContextPosition(undefined);
            if (!primaryCommit || !availability[action]) return;
            if (action === "copyRevision") {
                await navigator.clipboard.writeText(primaryCommit.oid);
                setToast(`Copied ${primaryCommit.oid.slice(0, 8)}`);
            } else if (action === "goToParent") selectRelative("parent");
            else if (action === "goToChild") selectRelative("child");
            else if (action === "cherryPick") {
                await executeOperation({
                    kind: "cherryPick",
                    revisions: selectedCommits.map((commit) => commit.oid),
                    noCommit: false,
                });
            } else if (action === "revert") {
                await executeOperation({
                    kind: "revert",
                    revisions: selectedCommits.map((commit) => commit.oid),
                    noCommit: false,
                });
            } else if (action === "reset") {
                const accepted = await dialog.confirm({
                    title: `Reset ${repository.snapshot.currentBranch ?? "HEAD"}?`,
                    description:
                        "A mixed reset moves the branch and resets the index while keeping working-tree changes.",
                    impact: `Target: ${primaryCommit.oid.slice(0, 12)}`,
                    confirmLabel: "Reset branch",
                    dangerous: true,
                });
                if (accepted) {
                    const mode = await dialog.input({
                        title: "Choose reset mode",
                        label: "Mode: soft, mixed, hard, or keep",
                        initialValue: "mixed",
                        description:
                            "Hard discards index and working-tree changes; keep refuses to overwrite local changes.",
                    });
                    if (
                        !mode ||
                        !["soft", "mixed", "hard", "keep"].includes(mode)
                    ) {
                        if (mode)
                            setToast(
                                "Reset mode must be soft, mixed, hard, or keep.",
                            );
                        return;
                    }
                    await executeOperation({
                        kind: "reset",
                        revision: primaryCommit.oid,
                        mode: mode as "soft" | "mixed" | "hard" | "keep",
                    });
                }
            } else if (action === "undoCommit") {
                const accepted = await dialog.confirm({
                    title: "Undo the last commit?",
                    description:
                        "Moves HEAD to its parent with a soft reset, keeping all committed changes staged.",
                    impact: `${primaryCommit.oid.slice(0, 8)} ${primaryCommit.subject}`,
                    confirmLabel: "Undo commit",
                    dangerous: true,
                });
                if (accepted)
                    await executeOperation({
                        kind: "undoCommit",
                    });
            } else if (action === "reword") {
                const message = await dialog.input({
                    title: "Reword commit",
                    label: "New commit message",
                    initialValue: primaryCommit.subject,
                    description:
                        "Interactive rebase rewrites this commit and all descendants.",
                });
                if (message) {
                    await executeOperation({
                        kind: "rewordCommit",
                        revision: primaryCommit.oid,
                        message,
                    });
                }
            } else if (action === "fixup") {
                await executeOperation({
                    kind: "createFixupCommit",
                    revision: primaryCommit.oid,
                });
            } else if (action === "squashInto") {
                await executeOperation({
                    kind: "createSquashCommit",
                    revision: primaryCommit.oid,
                });
            } else if (action === "newBranch") {
                const name = await dialog.input({
                    title: "Create branch",
                    label: "Branch name",
                    initialValue: "feat/",
                    description: `Starts at ${primaryCommit.oid.slice(0, 12)} without checking it out.`,
                });
                if (name) {
                    await executeOperation({
                        kind: "createBranch",
                        name,
                        startPoint: primaryCommit.oid,
                        checkout: false,
                    });
                }
            } else if (action === "newTag") {
                const name = await dialog.input({
                    title: "Create tag",
                    label: "Tag name",
                    initialValue: "v0.1.0",
                    description: `Creates a lightweight tag at ${primaryCommit.oid.slice(0, 12)}.`,
                });
                if (name) {
                    await executeOperation({
                        kind: "createTag",
                        name,
                        revision: primaryCommit.oid,
                        message: null,
                    });
                }
            } else if (action === "pushUpTo") {
                onOpenPush(primaryCommit.oid);
            } else if (action === "interactiveRebase") {
                setHistoryRewrite({
                    fromRevision: primaryCommit.oid,
                    squashOids: [],
                });
            } else if (action === "viewInBrowser") {
                const url = repository.snapshot.remoteUrl
                    ? commitUrl(
                          repository.snapshot.remoteUrl,
                          primaryCommit.oid,
                      )
                    : undefined;
                if (!url)
                    setToast(
                        "The origin remote is not a supported GitHub or GitLab URL.",
                    );
                else await openExternalUrl(url);
            } else if (action === "createPatch") {
                const targetPath = await selectPatchExportPath(
                    `${primaryCommit.oid.slice(0, 8)}.patch`,
                );
                if (!targetPath) return;
                const result = await exportPatch(
                    selectedCommits.map((commit) => commit.oid),
                    targetPath,
                );
                setToast(
                    `Exported ${result.commitCount} commit(s) · ${result.sizeBytes.toLocaleString()} bytes`,
                );
            } else if (action === "copyPatch") {
                const patch = await createPatchText(
                    selectedCommits.map((commit) => commit.oid),
                );
                await navigator.clipboard.writeText(patch);
                setToast(
                    `Copied patch · ${patch.length.toLocaleString()} characters`,
                );
            } else if (action === "showRepositoryAtRevision") {
                openInspector({
                    revision: primaryCommit.oid,
                    source: { kind: "revision", revision: primaryCommit.oid },
                    tab: "tree",
                });
            } else if (action === "compareVersions") {
                setRepositoryViewMode("history");
            } else if (action === "drop") {
                const accepted = await dialog.confirm({
                    title: `Drop ${selectedCommits.length} commit(s)?`,
                    description:
                        "Interactive rebase rewrites this branch and all descendant commit IDs.",
                    impact: selectedCommits
                        .map(
                            (commit) =>
                                `${commit.oid.slice(0, 8)} ${commit.subject}`,
                        )
                        .join("\n"),
                    confirmLabel: "Rewrite and drop",
                    dangerous: true,
                });
                if (accepted) {
                    await executeOperation({
                        kind: "dropCommits",
                        revisions: selectedCommits.map((commit) => commit.oid),
                    });
                }
            } else if (action === "squash") {
                const selected = new Set(
                    selectedCommits.map((commit) => commit.oid),
                );
                const oldest = repository.commits.findLast((commit) =>
                    selected.has(commit.oid),
                );
                if (oldest) {
                    setHistoryRewrite({
                        fromRevision: oldest.oid,
                        squashOids: selectedCommits.map((commit) => commit.oid),
                    });
                }
            }
        },
        [
            availability,
            dialog,
            onOpenPush,
            openInspector,
            primaryCommit,
            repository.commits,
            repository.snapshot,
            selectRelative,
            selectedCommits,
            createPatchText,
            executeOperation,
            exportPatch,
            setContextPosition,
            setHistoryRewrite,
            setRepositoryViewMode,
            setToast,
        ],
    );

    return {
        availability,
        commitsByOid,
        primaryCommit,
        runAction,
        selectRelative,
    };
}
