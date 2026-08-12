import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import type { ChangeEntry } from "../../domain/changeReview";
import type { Commit, RepositoryView } from "../../domain/types";
import type { GitSessionController } from "../../git-session/useGitSessionController";
import type { FileSource } from "../../shared/contracts/model";
import { useRepositoryWorkspaceStore } from "../state/RepositoryWorkspaceStoreProvider";
import type { DiffContentPair, DiffPreviewPair } from "../state/workspaceTypes";

const EMPTY_PREVIEW_PAIR: DiffPreviewPair = {
    before: null,
    after: null,
    loading: false,
};

const EMPTY_CONTENT_PAIR: DiffContentPair = {
    before: null,
    after: null,
    loading: false,
};

const EMPTY_TREE_OID = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

interface RepositoryContentLoaderOptions {
    readonly loadFile: GitSessionController["queries"]["readFile"];
    readonly loadFilePreview: GitSessionController["queries"]["readFilePreview"];
    readonly primaryCommit: Commit | undefined;
    readonly repository: RepositoryView;
    readonly workingEntries: readonly ChangeEntry[];
}

export function useRepositoryContentLoader({
    loadFile,
    loadFilePreview,
    primaryCommit,
    repository,
    workingEntries,
}: RepositoryContentLoaderOptions): void {
    const {
        changeSelection,
        commitFiles,
        historyParentRevision,
        historySelectedPath,
        runRepositoryTask,
        setChangeContent,
        setChangePreview,
        setHistoryContent,
        setHistoryPreview,
    } = useRepositoryWorkspaceStore(
        useShallow((state) => ({
            changeSelection: state.changeSelection,
            commitFiles: state.commitFiles,
            historyParentRevision: state.historyParentRevision,
            historySelectedPath: state.historySelectedPath,
            runRepositoryTask: state.runRepositoryTask,
            setChangeContent: state.setChangeContent,
            setChangePreview: state.setChangePreview,
            setHistoryContent: state.setHistoryContent,
            setHistoryPreview: state.setHistoryPreview,
        })),
    );
    const historyGeneration = useRef(0);
    const changeGeneration = useRef(0);

    useEffect(() => {
        const file = commitFiles.find(
            (candidate) => candidate.path === historySelectedPath,
        );
        if (!primaryCommit || !file) {
            setHistoryPreview(EMPTY_PREVIEW_PAIR);
            setHistoryContent(EMPTY_CONTENT_PAIR);
            return;
        }
        const generation = historyGeneration.current + 1;
        historyGeneration.current = generation;
        const beforeSource: FileSource = {
            kind: "revision",
            revision: historyParentRevision ?? EMPTY_TREE_OID,
        };
        const afterSource: FileSource = {
            kind: "revision",
            revision: primaryCommit.oid,
        };
        setHistoryPreview((current) => ({ ...current, loading: true }));
        setHistoryContent((current) => ({ ...current, loading: true }));
        void runRepositoryTask(
            () =>
                Promise.all([
                    loadFile(beforeSource, file.oldPath ?? file.path),
                    loadFile(afterSource, file.path),
                    file.binary
                        ? loadFilePreview(
                              beforeSource,
                              file.oldPath ?? file.path,
                          )
                        : Promise.resolve(null),
                    file.binary
                        ? loadFilePreview(afterSource, file.path)
                        : Promise.resolve(null),
                ]),
            ([beforeContent, afterContent, beforePreview, afterPreview]) => {
                if (historyGeneration.current !== generation) return;
                setHistoryContent({
                    before: beforeContent,
                    after: afterContent,
                    loading: false,
                });
                setHistoryPreview({
                    before: beforePreview,
                    after: afterPreview,
                    loading: false,
                });
            },
            () => {
                if (historyGeneration.current !== generation) return;
                setHistoryPreview(EMPTY_PREVIEW_PAIR);
                setHistoryContent(EMPTY_CONTENT_PAIR);
            },
        );
        return () => {
            if (historyGeneration.current === generation)
                historyGeneration.current += 1;
        };
    }, [
        commitFiles,
        historyParentRevision,
        historySelectedPath,
        loadFile,
        loadFilePreview,
        primaryCommit,
        runRepositoryTask,
        setHistoryContent,
        setHistoryPreview,
    ]);

    useEffect(() => {
        const entry = workingEntries.find(
            (candidate) =>
                changeSelection?.path === candidate.selection.path &&
                changeSelection.layer === candidate.selection.layer,
        );
        if (!entry) {
            setChangePreview(EMPTY_PREVIEW_PAIR);
            setChangeContent(EMPTY_CONTENT_PAIR);
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
        const generation = changeGeneration.current + 1;
        changeGeneration.current = generation;
        setChangePreview((current) => ({ ...current, loading: true }));
        setChangeContent((current) => ({ ...current, loading: true }));
        void runRepositoryTask(
            () =>
                Promise.all([
                    loadFile(before, entry.file.oldPath ?? entry.file.path),
                    loadFile(after, entry.file.path),
                    entry.file.binary
                        ? loadFilePreview(
                              before,
                              entry.file.oldPath ?? entry.file.path,
                          )
                        : Promise.resolve(null),
                    entry.file.binary
                        ? loadFilePreview(after, entry.file.path)
                        : Promise.resolve(null),
                ]),
            ([beforeContent, afterContent, beforePreview, afterPreview]) => {
                if (changeGeneration.current !== generation) return;
                setChangeContent({
                    before: beforeContent,
                    after: afterContent,
                    loading: false,
                });
                setChangePreview({
                    before: beforePreview,
                    after: afterPreview,
                    loading: false,
                });
            },
            () => {
                if (changeGeneration.current !== generation) return;
                setChangePreview(EMPTY_PREVIEW_PAIR);
                setChangeContent(EMPTY_CONTENT_PAIR);
            },
        );
        return () => {
            if (changeGeneration.current === generation)
                changeGeneration.current += 1;
        };
    }, [
        changeSelection,
        loadFile,
        loadFilePreview,
        repository.snapshot.headOid,
        runRepositoryTask,
        setChangeContent,
        setChangePreview,
        workingEntries,
    ]);
}
