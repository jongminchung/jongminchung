import { useCallback } from "react";
import type { GitBridge } from "../../../application/git-session/ports/GitBridge";
import type {
    GitSessionHistoryPort,
    GitSessionMutationPort,
    GitSessionQueryPort,
} from "../../../application/git-session/ports/GitSessionBackend";
import type { GitSessionRuntime } from "../../../application/git-session/state/GitSessionRuntime";
import type { GitSessionStore } from "../../../application/git-session/state/GitSessionStore";
import {
    parseBlame,
    parseCommitFiles,
    parseFileHistory,
    parseNameStatus,
    parseTree,
} from "../../../domain/parsers";
import {
    parseProjectTextMatches,
    type ProjectSearchOptions,
    type ProjectTextMatch,
} from "../../../domain/projectSearch";
import { repositoryAccessPolicy } from "../../../domain/repositoryAccess";
import type {
    BlameLine,
    Commit,
    FileChange,
    TreeEntry,
} from "../../../domain/types";
import type {
    GitLocalHistoryActivitiesPage,
    GitLocalHistoryActivity,
    GitLocalHistoryActivityDetail,
    GitLocalHistoryScope,
} from "../../../shared/contracts/git-utility";
import type {
    DiffOptions,
    FileContent,
    FilePreview,
    FileSource,
    GitRequest,
    PatchExportResult,
    RepositorySnapshot,
    RequestId,
    SubmoduleDiff,
} from "../../../shared/contracts/model/index";
import type { RunRequestOptions } from "./useGitRequestRuntime";

type FixtureData = typeof import("../../../domain/sampleData");

async function requireFixtureData(): Promise<FixtureData> {
    return import("../../../domain/sampleData");
}

interface GitSessionQueryDependencies {
    readonly activeSnapshot: () => RepositorySnapshot;
    readonly gitBridge: GitBridge;
    readonly historyPort: GitSessionHistoryPort;
    readonly mutationPort: GitSessionMutationPort;
    readonly queryPort: GitSessionQueryPort;
    readonly refreshAll: (repositoryId: string) => Promise<void>;
    readonly refreshCoordinator: GitSessionStore["refreshCoordinator"];
    readonly runRequest: (
        request: GitRequest,
        options?: RunRequestOptions,
    ) => Promise<string>;
    readonly runtime: GitSessionRuntime;
}

type ProjectTextSearchDependencies = Pick<
    GitSessionQueryDependencies,
    "activeSnapshot" | "gitBridge" | "queryPort" | "runRequest" | "runtime"
>;

export async function runProjectTextSearch(
    query: string,
    options: ProjectSearchOptions,
    {
        activeSnapshot,
        gitBridge,
        queryPort,
        runRequest,
        runtime,
    }: ProjectTextSearchDependencies,
): Promise<readonly ProjectTextMatch[]> {
    const previousRequest = runtime.activeSearchRequest;
    if (previousRequest !== null) {
        runtime.activeSearchRequest = null;
        void gitBridge.cancel(previousRequest);
    }
    if (query.length === 0) return [];

    return queryPort.search(query, async () => {
        const snapshot = activeSnapshot();
        let requestId: RequestId | null = null;
        try {
            const output = await runRequest(
                {
                    kind: "searchText",
                    repositoryId: snapshot.id,
                    query,
                    options,
                },
                {
                    onStarted: (startedRequestId) => {
                        requestId = startedRequestId;
                        runtime.activeSearchRequest = startedRequestId;
                    },
                },
            );
            return parseProjectTextMatches(output);
        } finally {
            if (
                requestId !== null &&
                runtime.activeSearchRequest === requestId
            ) {
                runtime.activeSearchRequest = null;
            }
        }
    });
}

export function useGitSessionQueryActions({
    activeSnapshot,
    gitBridge,
    historyPort,
    mutationPort,
    queryPort,
    refreshAll,
    refreshCoordinator,
    runRequest,
    runtime,
}: GitSessionQueryDependencies) {
    const loadCommitFiles = useCallback(
        (revision: string): Promise<readonly FileChange[]> =>
            queryPort.commitFiles(
                async () => {
                    const snapshot = activeSnapshot();
                    return parseCommitFiles(
                        await runRequest({
                            kind: "commitDetails",
                            repositoryId: snapshot.id,
                            revision,
                        }),
                    );
                },
                async () => (await requireFixtureData()).sampleCommitFiles,
            ),
        [activeSnapshot, queryPort, runRequest],
    );

    const loadCommitDiff = useCallback(
        (
            commit: Commit,
            path: string,
            options: DiffOptions,
            parentRevision?: string,
        ): Promise<string> =>
            queryPort.diff(
                () => {
                    const snapshot = activeSnapshot();
                    return runRequest({
                        kind: "diff",
                        repositoryId: snapshot.id,
                        from:
                            parentRevision ??
                            commit.parents[0] ??
                            "4b825dc642cb6eb9a060e54bf8d69288fbee4904",
                        to: commit.oid,
                        paths: [path],
                        staged: false,
                        options,
                    });
                },
                async () => (await requireFixtureData()).samplePatch,
            ),
        [activeSnapshot, queryPort, runRequest],
    );

    const loadWorkingDiff = useCallback(
        (
            path: string,
            staged: boolean,
            options: DiffOptions,
        ): Promise<string> =>
            queryPort.diff(
                () => {
                    const snapshot = activeSnapshot();
                    return runRequest({
                        kind: "diff",
                        repositoryId: snapshot.id,
                        from: null,
                        to: null,
                        paths: [path],
                        staged,
                        options,
                    });
                },
                async () => (await requireFixtureData()).samplePatch,
            ),
        [activeSnapshot, queryPort, runRequest],
    );

    const loadLocalChangesPatch = useCallback(
        (): Promise<string> =>
            queryPort.diff(
                () => {
                    const snapshot = activeSnapshot();
                    return runRequest({
                        kind: "diff",
                        repositoryId: snapshot.id,
                        from: snapshot.hasCommits
                            ? "HEAD"
                            : "4b825dc642cb6eb9a060e54bf8d69288fbee4904",
                        to: null,
                        paths: [],
                        staged: false,
                        options: { whitespace: "show", contextLines: 3 },
                    });
                },
                async () => (await requireFixtureData()).samplePatch,
            ),
        [activeSnapshot, queryPort, runRequest],
    );

    const loadRevisionDiff = useCallback(
        (
            from: string,
            to: string | null,
            options: DiffOptions,
            paths: readonly string[] = [],
        ): Promise<string> =>
            queryPort.diff(
                () => {
                    const snapshot = activeSnapshot();
                    return runRequest({
                        kind: "diff",
                        repositoryId: snapshot.id,
                        from,
                        to,
                        paths: [...paths],
                        staged: false,
                        options,
                    });
                },
                async () => (await requireFixtureData()).samplePatch,
            ),
        [activeSnapshot, queryPort, runRequest],
    );

    const listLocalHistoryActivities = useCallback(
        (
            scope: GitLocalHistoryScope,
            cursor: string | null,
            limit: number,
            query: string,
            showSystemEvents: boolean,
        ): Promise<GitLocalHistoryActivitiesPage> =>
            historyPort.listLocalActivities(() => {
                if (gitBridge.listLocalHistoryActivities === undefined)
                    throw new Error("Local History is unavailable");
                return gitBridge.listLocalHistoryActivities(
                    scope,
                    cursor,
                    limit,
                    query,
                    showSystemEvents,
                );
            }),
        [historyPort, gitBridge],
    );

    const readLocalHistoryActivity = useCallback(
        (activityId: string): Promise<GitLocalHistoryActivityDetail> =>
            historyPort.readLocalActivity(() => {
                if (gitBridge.readLocalHistoryActivity === undefined)
                    throw new Error("Local History is unavailable");
                return gitBridge.readLocalHistoryActivity(
                    activeSnapshot().id,
                    activityId,
                );
            }),
        [activeSnapshot, historyPort, gitBridge],
    );

    const loadLocalHistoryDiff = useCallback(
        (activityId: string, path: string): Promise<string> =>
            historyPort.localDiff(
                () => {
                    if (gitBridge.readLocalHistoryDiff === undefined)
                        throw new Error("Local History is unavailable");
                    return gitBridge.readLocalHistoryDiff(
                        activeSnapshot().id,
                        activityId,
                        path,
                    );
                },
                async () => (await requireFixtureData()).samplePatch,
            ),
        [activeSnapshot, historyPort, gitBridge],
    );

    const revertLocalHistory = useCallback(
        (
            activityId: string,
            paths: readonly string[],
            includeLater: boolean,
        ): Promise<void> =>
            historyPort.nativeOnly(
                "Local History requires the native app",
                async () => {
                    if (gitBridge.revertLocalHistory === undefined)
                        throw new Error("Local History is unavailable");
                    const snapshot = activeSnapshot();
                    repositoryAccessPolicy.assert(snapshot.id, "gitMutation");
                    await gitBridge.revertLocalHistory(
                        snapshot.id,
                        activityId,
                        paths,
                        includeLater,
                    );
                    await refreshAll(snapshot.id);
                },
            ),
        [activeSnapshot, historyPort, refreshAll, gitBridge],
    );

    const createLocalHistoryPatch = useCallback(
        (activityId: string, paths: readonly string[]): Promise<string> =>
            historyPort.nativeOnly(
                "Local History requires the native app",
                () => {
                    if (gitBridge.createLocalHistoryPatch === undefined)
                        throw new Error("Local History is unavailable");
                    return gitBridge.createLocalHistoryPatch(
                        activeSnapshot().id,
                        activityId,
                        paths,
                    );
                },
            ),
        [activeSnapshot, historyPort, gitBridge],
    );

    const putLocalHistoryLabel = useCallback(
        (label: string): Promise<GitLocalHistoryActivity> =>
            historyPort.nativeOnly(
                "Local History requires the native app",
                () => {
                    if (gitBridge.putLocalHistoryLabel === undefined)
                        throw new Error("Local History is unavailable");
                    const snapshot = activeSnapshot();
                    repositoryAccessPolicy.assert(snapshot.id, "gitMutation");
                    return gitBridge.putLocalHistoryLabel(snapshot.id, label);
                },
            ),
        [activeSnapshot, historyPort, gitBridge],
    );

    const exportPatch = useCallback(
        (
            revisions: readonly string[],
            targetPath: string,
        ): Promise<PatchExportResult> =>
            historyPort.nativeOnly(
                "Patch export requires the native app",
                () => {
                    const snapshot = activeSnapshot();
                    repositoryAccessPolicy.assert(
                        snapshot.id,
                        "externalExecution",
                    );
                    return gitBridge.exportPatch(
                        snapshot.id,
                        revisions,
                        targetPath,
                    );
                },
            ),
        [activeSnapshot, historyPort, gitBridge],
    );

    const createPatchText = useCallback(
        async (revisions: readonly string[]): Promise<string> => {
            return gitBridge.createPatchText(activeSnapshot().id, revisions);
        },
        [activeSnapshot, gitBridge],
    );

    const importPatch = useCallback(
        async (path: string): Promise<void> => {
            const snapshot = activeSnapshot();
            repositoryAccessPolicy.assert(snapshot.id, "gitMutation");
            await gitBridge.importPatch(snapshot.id, path);
            refreshCoordinator.invalidate(snapshot.id, ["status", "history"]);
            await refreshCoordinator.flush(snapshot.id);
        },
        [activeSnapshot, refreshCoordinator, gitBridge],
    );

    const loadTree = useCallback(
        (revision: string, path?: string): Promise<readonly TreeEntry[]> =>
            queryPort.tree(async () => {
                const snapshot = activeSnapshot();
                return parseTree(
                    await runRequest({
                        kind: "tree",
                        repositoryId: snapshot.id,
                        revision,
                        path: path ?? null,
                    }),
                );
            }),
        [activeSnapshot, queryPort, runRequest],
    );

    const loadFiles = useCallback(
        (): Promise<readonly string[]> =>
            queryPort.files(async () => {
                const snapshot = activeSnapshot();
                const output = await runRequest({
                    kind: "files",
                    repositoryId: snapshot.id,
                });
                return [...new Set(output.split("\0").filter(Boolean))].sort(
                    (left, right) => left.localeCompare(right),
                );
            }),
        [activeSnapshot, queryPort, runRequest],
    );

    const searchProjectText = useCallback(
        (
            query: string,
            options: ProjectSearchOptions,
        ): Promise<readonly ProjectTextMatch[]> =>
            runProjectTextSearch(query, options, {
                activeSnapshot,
                gitBridge,
                queryPort,
                runRequest,
                runtime,
            }),
        [activeSnapshot, queryPort, runRequest, gitBridge, runtime],
    );

    const loadFileHistory = useCallback(
        (path: string): Promise<readonly Commit[]> =>
            historyPort.fileHistory(
                async () => {
                    const snapshot = activeSnapshot();
                    return parseFileHistory(
                        await runRequest({
                            kind: "fileHistory",
                            repositoryId: snapshot.id,
                            path,
                            skip: 0,
                            limit: 500,
                        }),
                    );
                },
                async () =>
                    (await requireFixtureData()).sampleRepository.commits.slice(
                        0,
                        8,
                    ),
            ),
        [activeSnapshot, historyPort, runRequest],
    );

    const loadBlame = useCallback(
        (path: string, revision?: string): Promise<readonly BlameLine[]> =>
            queryPort.blame(async () => {
                const snapshot = activeSnapshot();
                return parseBlame(
                    await runRequest({
                        kind: "blame",
                        repositoryId: snapshot.id,
                        revision: revision ?? null,
                        path,
                    }),
                );
            }),
        [activeSnapshot, queryPort, runRequest],
    );

    const readFile = useCallback(
        (source: FileSource, path: string): Promise<FileContent> =>
            queryPort.readFile(
                source,
                path,
                () => gitBridge.readFile(activeSnapshot().id, source, path),
                async () => {
                    const { sampleFileContent } = await requireFixtureData();
                    const content = sampleFileContent(path, source);
                    return {
                        kind: "text",
                        path,
                        content,
                        sizeBytes: new TextEncoder().encode(content).byteLength,
                        lineCount: content.split("\n").length,
                    };
                },
            ),
        [activeSnapshot, queryPort, gitBridge],
    );

    const readFilePreview = useCallback(
        (source: FileSource, path: string): Promise<FilePreview> =>
            queryPort.readFilePreview(path, () =>
                gitBridge.readFilePreview(activeSnapshot().id, source, path),
            ),
        [activeSnapshot, queryPort, gitBridge],
    );

    const writeWorkingTreeFile = useCallback(
        (path: string, content: string, activityName?: string): Promise<void> =>
            mutationPort.nativeOnly(
                "Editing files requires the native app",
                async () => {
                    if (gitBridge.writeWorkingTreeFile === undefined)
                        throw new Error("File editing is unavailable");
                    const snapshot = activeSnapshot();
                    repositoryAccessPolicy.assert(snapshot.id, "gitMutation");
                    await gitBridge.writeWorkingTreeFile(
                        snapshot.id,
                        path,
                        content,
                        activityName,
                    );
                    refreshCoordinator.invalidate(snapshot.id, ["status"]);
                    await refreshCoordinator.flush(snapshot.id);
                },
            ),
        [activeSnapshot, mutationPort, refreshCoordinator, gitBridge],
    );

    const loadSubmoduleDiff = useCallback(
        (
            before: FileSource,
            after: FileSource,
            path: string,
        ): Promise<SubmoduleDiff> =>
            queryPort.submoduleDiff(path, () =>
                gitBridge.loadSubmoduleDiff(
                    activeSnapshot().id,
                    before,
                    after,
                    path,
                ),
            ),
        [activeSnapshot, queryPort, gitBridge],
    );

    const openWorkingTreeFile = useCallback(
        (path: string): Promise<void> =>
            queryPort.openWorkingTreeFile(async () => {
                const snapshot = activeSnapshot();
                repositoryAccessPolicy.assert(snapshot.id, "externalExecution");
                await gitBridge.openWorkingTreeFile(snapshot.id, path);
            }),
        [activeSnapshot, queryPort, gitBridge],
    );

    const loadStashFiles = useCallback(
        (stash: string): Promise<readonly FileChange[]> =>
            historyPort.stashFiles(
                async () => {
                    const snapshot = activeSnapshot();
                    return parseNameStatus(
                        await runRequest({
                            kind: "stashShow",
                            repositoryId: snapshot.id,
                            stash,
                            mode: "files",
                        }),
                    );
                },
                async () =>
                    (await requireFixtureData()).sampleCommitFiles.slice(0, 2),
            ),
        [activeSnapshot, historyPort, runRequest],
    );

    const loadStashPatch = useCallback(
        (stash: string): Promise<string> =>
            historyPort.stashPatch(
                () => {
                    const snapshot = activeSnapshot();
                    return runRequest({
                        kind: "stashShow",
                        repositoryId: snapshot.id,
                        stash,
                        mode: "patch",
                    });
                },
                async () => (await requireFixtureData()).samplePatch,
            ),
        [activeSnapshot, historyPort, runRequest],
    );

    return {
        loadCommitFiles,
        loadCommitDiff,
        loadWorkingDiff,
        loadLocalChangesPatch,
        loadRevisionDiff,
        listLocalHistoryActivities,
        readLocalHistoryActivity,
        loadLocalHistoryDiff,
        revertLocalHistory,
        createLocalHistoryPatch,
        putLocalHistoryLabel,
        exportPatch,
        createPatchText,
        importPatch,
        loadTree,
        loadFiles,
        searchProjectText,
        loadFileHistory,
        loadBlame,
        readFile,
        readFilePreview,
        writeWorkingTreeFile,
        loadSubmoduleDiff,
        openWorkingTreeFile,
        loadStashFiles,
        loadStashPatch,
    };
}
