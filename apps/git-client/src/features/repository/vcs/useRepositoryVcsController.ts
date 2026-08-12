import { useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
    exportPatchText,
    readClipboardText,
    selectPatchImportPath,
} from "../../../application/desktop/DesktopPort";
import type { GitSessionCapabilities } from "../../../application/git-session/ports/GitSessionCapabilities";
import { useAppDialog } from "../../../components/AppDialog";
import { changeEntries } from "../../../domain/changeReview";
import type { RepositoryView } from "../../../domain/types";
import type { DiffOptions } from "../../../shared/contracts/model/index";
import { useRepositoryWorkspaceStore } from "../state/RepositoryWorkspaceStoreProvider";
import type { InspectorState } from "../state/workspaceTypes";

interface RepositoryVcsControllerOptions {
    readonly executeOperation: GitSessionCapabilities["mutations"]["executeOperation"];
    readonly importPatch: GitSessionCapabilities["mutations"]["importPatch"];
    readonly inspector: InspectorState | undefined;
    readonly loadLocalChangesPatch: GitSessionCapabilities["queries"]["loadLocalChangesPatch"];
    readonly loadRevisionDiff: GitSessionCapabilities["queries"]["loadRevisionDiff"];
    readonly openInspector: (next: InspectorState, keepOpen?: boolean) => void;
    readonly repository: RepositoryView;
}

export function useRepositoryVcsController({
    executeOperation,
    importPatch,
    inspector,
    loadLocalChangesPatch,
    loadRevisionDiff,
    openInspector,
    repository,
}: RepositoryVcsControllerOptions) {
    const dialog = useAppDialog();
    const {
        changeSelection,
        diffPreferences,
        historySelectedPath,
        setBookmarksOpen,
        setChangeSelection,
        setDiffState,
        setProjectOpen,
        setRepositoryViewMode,
        setToast,
    } = useRepositoryWorkspaceStore(
        useShallow((state) => ({
            changeSelection: state.changeSelection,
            diffPreferences: state.diffPreferences,
            historySelectedPath: state.historySelectedPath,
            setBookmarksOpen: state.setBookmarksOpen,
            setChangeSelection: state.setChangeSelection,
            setDiffState: state.setDiffState,
            setProjectOpen: state.setProjectOpen,
            setRepositoryViewMode: state.setRepositoryViewMode,
            setToast: state.setToast,
        })),
    );
    const workingEntries = useMemo(
        () => changeEntries(repository.status),
        [repository.status],
    );
    const vcsFilePath =
        (inspector && inspector.scratchId === undefined
            ? inspector.path
            : null) ??
        changeSelection?.path ??
        historySelectedPath ??
        null;
    const vcsFileChange = vcsFilePath
        ? (repository.status.changes.find(
              (change) => change.path === vcsFilePath,
          ) ?? null)
        : null;
    const vcsFileEntry = vcsFilePath
        ? (workingEntries.find(
              (entry) =>
                  entry.selection.path === vcsFilePath &&
                  entry.selection.layer === "worktree",
          ) ??
          workingEntries.find(
              (entry) => entry.selection.path === vcsFilePath,
          ) ??
          null)
        : null;
    const vcsFileVersioned = Boolean(
        vcsFilePath && vcsFileChange?.status !== "untracked",
    );
    const untrackedPaths = useMemo(
        () =>
            repository.status.changes
                .filter((change) => change.status === "untracked")
                .map((change) => change.path),
        [repository.status.changes],
    );
    const hasTrackedWorkingChanges = repository.status.changes.some(
        (change) => change.status !== "untracked" && change.worktree,
    );
    const conflictedFile = repository.status.changes.find(
        (change) => change.status === "conflicted",
    );

    const openVcsFileTab = useCallback(
        (tab: "history" | "blame"): void => {
            if (!vcsFilePath) return;
            setRepositoryViewMode("history");
            openInspector({
                revision: repository.snapshot.headOid ?? "HEAD",
                source: { kind: "workingTree" },
                path: vcsFilePath,
                tab,
            });
        },
        [
            openInspector,
            repository.snapshot.headOid,
            setRepositoryViewMode,
            vcsFilePath,
        ],
    );

    const rollbackVcsFile = useCallback(async (): Promise<void> => {
        if (!vcsFileChange || !vcsFileChange.worktree) return;
        const accepted = await dialog.confirm({
            title: `Rollback ${vcsFileChange.path}?`,
            description:
                "Restore the working-tree file to its indexed version.",
            impact: "Uncommitted working-tree edits in this file will be lost.",
            confirmLabel: "Rollback",
            dangerous: true,
        });
        if (!accepted) return;
        await executeOperation({
            kind: "discard",
            paths: [vcsFileChange.path],
        });
    }, [dialog, executeOperation, vcsFileChange]);

    const showVcsFileChanges = useCallback((): void => {
        if (!vcsFileEntry) return;
        setProjectOpen(false);
        setBookmarksOpen(false);
        setChangeSelection(vcsFileEntry.selection);
        setRepositoryViewMode("changes");
    }, [
        setBookmarksOpen,
        setChangeSelection,
        setProjectOpen,
        setRepositoryViewMode,
        vcsFileEntry,
    ]);

    const compareVcsFile = useCallback(
        async (selection: "revision" | "ref"): Promise<void> => {
            if (!vcsFilePath || !repository.snapshot.headOid) return;
            const revision = await dialog.input({
                title:
                    selection === "ref"
                        ? "Compare with Branch or Tag"
                        : "Compare with Revision",
                label: selection === "ref" ? "Branch or tag" : "Revision",
                initialValue:
                    selection === "ref"
                        ? (repository.snapshot.upstream ?? "main")
                        : "HEAD~1",
                description: `Compare the selected repository version of ${vcsFilePath} with the working tree.`,
            });
            if (!revision) return;
            const file = vcsFileChange ?? {
                path: vcsFilePath,
                status: "modified" as const,
                staged: false,
                worktree: false,
            };
            setDiffState({ file, patch: "", loading: true, mode: "readOnly" });
            const options: DiffOptions = {
                whitespace: diffPreferences.whitespace,
                contextLines:
                    diffPreferences.contextLines === "full"
                        ? null
                        : diffPreferences.contextLines,
            };
            try {
                const patch = await loadRevisionDiff(revision, null, options, [
                    vcsFilePath,
                ]);
                setDiffState({ file, patch, loading: false, mode: "readOnly" });
            } catch (error) {
                setDiffState({
                    file,
                    patch: `Unable to compare repository versions: ${String(error)}`,
                    loading: false,
                    mode: "readOnly",
                });
            }
        },
        [
            dialog,
            diffPreferences,
            loadRevisionDiff,
            repository.snapshot.headOid,
            repository.snapshot.upstream,
            setDiffState,
            vcsFileChange,
            vcsFilePath,
        ],
    );

    const createPatchFromLocalChanges = useCallback(async (): Promise<void> => {
        const patch = await loadLocalChangesPatch();
        if (patch.trim() === "")
            throw new Error("There are no tracked local changes to export.");
        if (
            await exportPatchText({
                defaultName: `${repository.snapshot.name}.patch`,
                content: patch,
            })
        ) {
            setToast(
                `Exported local changes · ${patch.length.toLocaleString()} characters`,
            );
        }
    }, [loadLocalChangesPatch, repository.snapshot.name, setToast]);

    const applyPatchFromFile = useCallback(async (): Promise<void> => {
        const selectedPath = await selectPatchImportPath();
        if (selectedPath === null) return;
        await importPatch(selectedPath);
        setToast("Patch applied to the index and working tree.");
    }, [importPatch, setToast]);

    const applyPatchFromClipboard = useCallback(async (): Promise<void> => {
        const patch = await readClipboardText();
        if (patch.trim() === "")
            throw new Error("The clipboard does not contain a patch.");
        const accepted = await dialog.confirm({
            title: "Apply Patch",
            description:
                "Apply the Git patch from the clipboard to the working tree?",
            impact: `${patch.length.toLocaleString()} characters`,
            confirmLabel: "Apply Patch",
        });
        if (!accepted) return;
        await executeOperation({
            kind: "applyPatch",
            patch,
            cached: false,
            reverse: false,
        });
        setToast("Clipboard patch applied to the working tree.");
    }, [dialog, executeOperation, setToast]);

    return {
        applyPatchFromClipboard,
        applyPatchFromFile,
        compareVcsFile,
        conflictedFile,
        createPatchFromLocalChanges,
        hasTrackedWorkingChanges,
        openVcsFileTab,
        rollbackVcsFile,
        showVcsFileChanges,
        untrackedPaths,
        vcsFileChange,
        vcsFileEntry,
        vcsFilePath,
        vcsFileVersioned,
        workingEntries,
    };
}
