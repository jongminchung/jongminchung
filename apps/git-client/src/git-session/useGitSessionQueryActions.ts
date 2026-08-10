import { useCallback } from "react";
import type { GitBridge } from "../bridge/GitBridge";
import {
  parseBlame,
  parseCommitFiles,
  parseFileHistory,
  parseNameStatus,
  parseTree,
} from "../domain/parsers";
import {
  parseProjectTextMatches,
  type ProjectSearchOptions,
  type ProjectTextMatch,
} from "../domain/projectSearch";
import { repositoryAccessPolicy } from "../domain/repositoryAccess";
import type { BlameLine, Commit, FileChange, TreeEntry } from "../domain/types";
import type {
  GitLocalHistoryActivitiesPage,
  GitLocalHistoryActivity,
  GitLocalHistoryActivityDetail,
  GitLocalHistoryScope,
} from "../shared/contracts/git-utility";
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
} from "../shared/contracts/model";
import type { GitSessionRuntime } from "./gitSessionRuntime";
import type { GitSessionStore } from "./gitSessionStore";
import type { RunRequestOptions } from "./useGitRequestRuntime";

type FixtureData = typeof import("../domain/sampleData");

async function requireFixtureData(): Promise<FixtureData> {
  return import("../domain/sampleData");
}

interface GitSessionQueryDependencies {
  readonly activeSnapshot: () => RepositorySnapshot;
  readonly fixture: boolean;
  readonly gitBridge: GitBridge;
  readonly refreshAll: (repositoryId: string) => Promise<void>;
  readonly refreshCoordinator: GitSessionStore["refreshCoordinator"];
  readonly runRequest: (request: GitRequest, options?: RunRequestOptions) => Promise<string>;
  readonly runtime: GitSessionRuntime;
}

export function useGitSessionQueryActions({
  activeSnapshot,
  fixture,
  gitBridge,
  refreshAll,
  refreshCoordinator,
  runRequest,
  runtime,
}: GitSessionQueryDependencies) {
  const loadCommitFiles = useCallback(
    async (revision: string): Promise<readonly FileChange[]> => {
      if (fixture) return (await requireFixtureData()).sampleCommitFiles;
      const snapshot = activeSnapshot();
      return parseCommitFiles(
        await runRequest({
          kind: "commitDetails",
          repositoryId: snapshot.id,
          revision,
        }),
      );
    },
    [activeSnapshot, fixture, runRequest],
  );

  const loadCommitDiff = useCallback(
    async (
      commit: Commit,
      path: string,
      options: DiffOptions,
      parentRevision?: string,
    ): Promise<string> => {
      if (fixture) return (await requireFixtureData()).samplePatch;
      const snapshot = activeSnapshot();
      return runRequest({
        kind: "diff",
        repositoryId: snapshot.id,
        from: parentRevision ?? commit.parents[0] ?? "4b825dc642cb6eb9a060e54bf8d69288fbee4904",
        to: commit.oid,
        paths: [path],
        staged: false,
        options,
      });
    },
    [activeSnapshot, fixture, runRequest],
  );

  const loadWorkingDiff = useCallback(
    async (path: string, staged: boolean, options: DiffOptions): Promise<string> => {
      if (fixture) return (await requireFixtureData()).samplePatch;
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
    [activeSnapshot, fixture, runRequest],
  );

  const loadLocalChangesPatch = useCallback(async (): Promise<string> => {
    if (fixture) return (await requireFixtureData()).samplePatch;
    const snapshot = activeSnapshot();
    return runRequest({
      kind: "diff",
      repositoryId: snapshot.id,
      from: snapshot.hasCommits ? "HEAD" : "4b825dc642cb6eb9a060e54bf8d69288fbee4904",
      to: null,
      paths: [],
      staged: false,
      options: { whitespace: "show", contextLines: 3 },
    });
  }, [activeSnapshot, fixture, runRequest]);

  const loadRevisionDiff = useCallback(
    async (
      from: string,
      to: string | null,
      options: DiffOptions,
      paths: readonly string[] = [],
    ): Promise<string> => {
      if (fixture) return (await requireFixtureData()).samplePatch;
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
    [activeSnapshot, fixture, runRequest],
  );

  const listLocalHistoryActivities = useCallback(
    async (
      scope: GitLocalHistoryScope,
      cursor: string | null,
      limit: number,
      query: string,
      showSystemEvents: boolean,
    ): Promise<GitLocalHistoryActivitiesPage> => {
      if (fixture) return { activities: [], nextCursor: null };
      if (gitBridge.listLocalHistoryActivities === undefined)
        throw new Error("Local History is unavailable");
      return gitBridge.listLocalHistoryActivities(scope, cursor, limit, query, showSystemEvents);
    },
    [fixture, gitBridge],
  );

  const readLocalHistoryActivity = useCallback(
    async (activityId: string): Promise<GitLocalHistoryActivityDetail> => {
      if (fixture) throw new Error("Local History requires the native app");
      if (gitBridge.readLocalHistoryActivity === undefined)
        throw new Error("Local History is unavailable");
      return gitBridge.readLocalHistoryActivity(activeSnapshot().id, activityId);
    },
    [activeSnapshot, fixture, gitBridge],
  );

  const loadLocalHistoryDiff = useCallback(
    async (activityId: string, path: string): Promise<string> => {
      if (fixture) return (await requireFixtureData()).samplePatch;
      if (gitBridge.readLocalHistoryDiff === undefined)
        throw new Error("Local History is unavailable");
      return gitBridge.readLocalHistoryDiff(activeSnapshot().id, activityId, path);
    },
    [activeSnapshot, fixture, gitBridge],
  );

  const revertLocalHistory = useCallback(
    async (activityId: string, paths: readonly string[], includeLater: boolean): Promise<void> => {
      if (fixture) throw new Error("Local History requires the native app");
      if (gitBridge.revertLocalHistory === undefined)
        throw new Error("Local History is unavailable");
      const snapshot = activeSnapshot();
      repositoryAccessPolicy.assert(snapshot.id, "gitMutation");
      await gitBridge.revertLocalHistory(snapshot.id, activityId, paths, includeLater);
      await refreshAll(snapshot.id);
    },
    [activeSnapshot, fixture, refreshAll, gitBridge],
  );

  const createLocalHistoryPatch = useCallback(
    async (activityId: string, paths: readonly string[]): Promise<string> => {
      if (fixture) throw new Error("Local History requires the native app");
      if (gitBridge.createLocalHistoryPatch === undefined)
        throw new Error("Local History is unavailable");
      return gitBridge.createLocalHistoryPatch(activeSnapshot().id, activityId, paths);
    },
    [activeSnapshot, fixture, gitBridge],
  );

  const putLocalHistoryLabel = useCallback(
    async (label: string): Promise<GitLocalHistoryActivity> => {
      if (fixture) throw new Error("Local History requires the native app");
      if (gitBridge.putLocalHistoryLabel === undefined)
        throw new Error("Local History is unavailable");
      const snapshot = activeSnapshot();
      repositoryAccessPolicy.assert(snapshot.id, "gitMutation");
      return gitBridge.putLocalHistoryLabel(snapshot.id, label);
    },
    [activeSnapshot, fixture, gitBridge],
  );

  const exportPatch = useCallback(
    async (revisions: readonly string[], targetPath: string): Promise<PatchExportResult> => {
      if (fixture) throw new Error("Patch export requires the native app");
      const snapshot = activeSnapshot();
      repositoryAccessPolicy.assert(snapshot.id, "externalExecution");
      return gitBridge.exportPatch(snapshot.id, revisions, targetPath);
    },
    [activeSnapshot, fixture, gitBridge],
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
    async (revision: string, path?: string): Promise<readonly TreeEntry[]> => {
      if (fixture) return [];
      const snapshot = activeSnapshot();
      return parseTree(
        await runRequest({
          kind: "tree",
          repositoryId: snapshot.id,
          revision,
          path: path ?? null,
        }),
      );
    },
    [activeSnapshot, fixture, runRequest],
  );

  const loadFiles = useCallback(async (): Promise<readonly string[]> => {
    if (fixture) return [];
    const snapshot = activeSnapshot();
    const output = await runRequest({
      kind: "files",
      repositoryId: snapshot.id,
    });
    return [...new Set(output.split("\0").filter(Boolean))].sort((left, right) =>
      left.localeCompare(right),
    );
  }, [activeSnapshot, fixture, runRequest]);

  const searchProjectText = useCallback(
    async (query: string, options: ProjectSearchOptions): Promise<readonly ProjectTextMatch[]> => {
      const previousRequest = runtime.activeSearchRequest;
      if (previousRequest !== null) {
        runtime.activeSearchRequest = null;
        void gitBridge.cancel(previousRequest);
      }
      if (fixture || query.length === 0) return [];
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
        if (requestId !== null && runtime.activeSearchRequest === requestId) {
          runtime.activeSearchRequest = null;
        }
      }
    },
    [activeSnapshot, fixture, runRequest, gitBridge, runtime],
  );

  const loadFileHistory = useCallback(
    async (path: string): Promise<readonly Commit[]> => {
      if (fixture) return (await requireFixtureData()).sampleRepository.commits.slice(0, 8);
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
    [activeSnapshot, fixture, runRequest],
  );

  const loadBlame = useCallback(
    async (path: string, revision?: string): Promise<readonly BlameLine[]> => {
      if (fixture) return [];
      const snapshot = activeSnapshot();
      return parseBlame(
        await runRequest({
          kind: "blame",
          repositoryId: snapshot.id,
          revision: revision ?? null,
          path,
        }),
      );
    },
    [activeSnapshot, fixture, runRequest],
  );

  const readFile = useCallback(
    async (source: FileSource, path: string): Promise<FileContent> => {
      if (fixture) {
        const { sampleFileContent } = await requireFixtureData();
        const content = sampleFileContent(path, source);
        return {
          kind: "text",
          path,
          content,
          sizeBytes: new TextEncoder().encode(content).byteLength,
          lineCount: content.split("\n").length,
        };
      }
      return gitBridge.readFile(activeSnapshot().id, source, path);
    },
    [activeSnapshot, fixture, gitBridge],
  );

  const readFilePreview = useCallback(
    async (source: FileSource, path: string): Promise<FilePreview> => {
      if (fixture) {
        return { kind: "binary", path, sizeBytes: 0 };
      }
      return gitBridge.readFilePreview(activeSnapshot().id, source, path);
    },
    [activeSnapshot, fixture, gitBridge],
  );

  const writeWorkingTreeFile = useCallback(
    async (path: string, content: string, activityName?: string): Promise<void> => {
      if (fixture) throw new Error("Editing files requires the native app");
      if (gitBridge.writeWorkingTreeFile === undefined)
        throw new Error("File editing is unavailable");
      const snapshot = activeSnapshot();
      repositoryAccessPolicy.assert(snapshot.id, "gitMutation");
      await gitBridge.writeWorkingTreeFile(snapshot.id, path, content, activityName);
      refreshCoordinator.invalidate(snapshot.id, ["status"]);
      await refreshCoordinator.flush(snapshot.id);
    },
    [activeSnapshot, fixture, refreshCoordinator, gitBridge],
  );

  const loadSubmoduleDiff = useCallback(
    async (before: FileSource, after: FileSource, path: string): Promise<SubmoduleDiff> => {
      if (fixture) {
        return {
          path,
          beforeOid: null,
          afterOid: null,
          beforeSubject: null,
          afterSubject: null,
          ahead: null,
          behind: null,
        };
      }
      return gitBridge.loadSubmoduleDiff(activeSnapshot().id, before, after, path);
    },
    [activeSnapshot, fixture, gitBridge],
  );

  const openWorkingTreeFile = useCallback(
    async (path: string): Promise<void> => {
      if (fixture) return;
      const snapshot = activeSnapshot();
      repositoryAccessPolicy.assert(snapshot.id, "externalExecution");
      await gitBridge.openWorkingTreeFile(snapshot.id, path);
    },
    [activeSnapshot, fixture, gitBridge],
  );

  const loadStashFiles = useCallback(
    async (stash: string): Promise<readonly FileChange[]> => {
      if (fixture) return (await requireFixtureData()).sampleCommitFiles.slice(0, 2);
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
    [activeSnapshot, fixture, runRequest],
  );

  const loadStashPatch = useCallback(
    async (stash: string): Promise<string> => {
      if (fixture) return (await requireFixtureData()).samplePatch;
      const snapshot = activeSnapshot();
      return runRequest({
        kind: "stashShow",
        repositoryId: snapshot.id,
        stash,
        mode: "patch",
      });
    },
    [activeSnapshot, fixture, runRequest],
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
