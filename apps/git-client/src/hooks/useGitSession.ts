import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isTauriRuntime, TauriGitBridge } from "../bridge/GitBridge";
import {
  parseBlame,
  parseCommitFiles,
  parseFileHistory,
  parseLog,
  parseRefs,
  parseStatusV2,
  parseTree,
} from "../domain/parsers";
import { sampleRepository, sampleShelves } from "../domain/sampleData";
import type {
  BlameLine,
  Commit,
  ConsoleEntry,
  FileChange,
  RepositoryView,
  TreeEntry,
} from "../domain/types";
import type {
  Changelist,
  ConflictContent,
  ConflictFile,
  GitEvent,
  GitOperation,
  GitRequest,
  MultiRootOutcome,
  MultiRootResult,
  MultiRootRollbackStep,
  RecoveryEntry,
  RemoteInfo,
  RepositorySnapshot,
  ShelfEntry,
  WorktreeInfo,
} from "../generated";

const bridge = new TauriGitBridge();

interface SessionState {
  readonly repository: RepositoryView;
  readonly consoleEntries: readonly ConsoleEntry[];
  readonly loading: boolean;
  readonly shelves: readonly ShelfEntry[];
  readonly changelists: readonly Changelist[];
  readonly recoveryEntries: readonly RecoveryEntry[];
  readonly conflicts: readonly ConflictFile[];
  readonly remotes: readonly RemoteInfo[];
  readonly worktrees: readonly WorktreeInfo[];
  readonly openRepositories: readonly RepositorySnapshot[];
  readonly error?: string;
}

function entryId(): string {
  return crypto.randomUUID();
}

export function useGitSession() {
  const [state, setState] = useState<SessionState>({
    repository: sampleRepository,
    consoleEntries: [],
    shelves: sampleShelves,
    changelists: [],
    recoveryEntries: [],
    conflicts: [],
    remotes: [],
    worktrees: [],
    openRepositories: isTauriRuntime() ? [] : [sampleRepository.snapshot],
    loading: false,
  });
  const requests = useRef(new Map<string, string>());
  const refreshInFlight = useRef<Promise<void> | undefined>(undefined);
  const watchedRepository = useRef<string | undefined>(undefined);

  useEffect(
    () => () => {
      if (watchedRepository.current) void bridge.unwatchRepository(watchedRepository.current);
    },
    [],
  );

  const runRequest = useCallback((request: GitRequest): Promise<string> => {
    return new Promise((resolve, reject) => {
      let output = "";
      let consoleId = entryId();
      const onEvent = (event: GitEvent) => {
        if (event.kind === "started") {
          consoleId = entryId();
          requests.current.set(event.requestId, consoleId);
          setState((current) => ({
            ...current,
            consoleEntries: [
              ...current.consoleEntries,
              {
                id: consoleId,
                command: event.displayCommand,
                startedAt: event.startedAtMs,
                status: "running",
                output: "",
              },
            ],
          }));
        } else if (event.kind === "output") {
          output += event.data;
          setState((current) => ({
            ...current,
            consoleEntries: current.consoleEntries.map((entry) =>
              entry.id === consoleId ? { ...entry, output: entry.output + event.data } : entry,
            ),
          }));
        } else if (event.kind === "completed") {
          setState((current) => ({
            ...current,
            consoleEntries: current.consoleEntries.map((entry) =>
              entry.id === consoleId
                ? { ...entry, status: "success", duration: event.durationMs }
                : entry,
            ),
          }));
          resolve(output);
        } else if (event.kind === "cancelled") {
          setState((current) => ({
            ...current,
            consoleEntries: current.consoleEntries.map((entry) =>
              entry.id === consoleId
                ? { ...entry, status: "cancelled", duration: event.durationMs }
                : entry,
            ),
          }));
          reject(new Error("Git request cancelled"));
        } else if (event.kind === "failed") {
          setState((current) => ({
            ...current,
            consoleEntries: current.consoleEntries.map((entry) =>
              entry.id === consoleId
                ? {
                    ...entry,
                    status: "failure",
                    duration: event.durationMs,
                    output: `${entry.output}\n${event.message}`,
                  }
                : entry,
            ),
          }));
          reject(new Error(event.message));
        }
      };
      void bridge.execute(request, onEvent).catch(reject);
    });
  }, []);

  const refresh = useCallback(
    async (snapshot: RepositorySnapshot) => {
      const repositoryId = snapshot.id;
      const [
        refsOutput,
        logOutput,
        statusOutput,
        shelves,
        changelists,
        recoveryEntries,
        conflicts,
        remotes,
        worktrees,
      ] = await Promise.all([
        runRequest({ kind: "refs", repositoryId }),
        runRequest({
          kind: "log",
          repositoryId,
          skip: 0,
          limit: 500,
          order: "topology",
          filters: {
            query: null,
            branch: null,
            author: null,
            since: null,
            until: null,
            paths: [],
            noMerges: false,
          },
        }),
        runRequest({ kind: "status", repositoryId }),
        bridge.listShelves(repositoryId),
        bridge.listChangelists(repositoryId),
        bridge.listRecoveryEntries(repositoryId),
        bridge.listConflicts(repositoryId),
        bridge.listRemotes(repositoryId),
        bridge.listWorktrees(repositoryId),
      ]);
      const refreshedSnapshot = await bridge.refreshRepository(repositoryId);
      setState((current) => ({
        ...current,
        repository: {
          snapshot: refreshedSnapshot,
          refs: parseRefs(refsOutput),
          commits: parseLog(logOutput),
          status: parseStatusV2(statusOutput),
        },
        shelves,
        changelists,
        recoveryEntries,
        conflicts,
        remotes,
        worktrees,
        openRepositories: [
          ...current.openRepositories.filter(
            (repository) => repository.id !== refreshedSnapshot.id,
          ),
          refreshedSnapshot,
        ],
        loading: false,
        error: undefined,
      }));
    },
    [runRequest],
  );

  const activateRepository = useCallback(
    async (snapshot: RepositorySnapshot) => {
      await refresh(snapshot);
      if (watchedRepository.current) await bridge.unwatchRepository(watchedRepository.current);
      watchedRepository.current = snapshot.id;
      await bridge.watchRepository(snapshot.id, () => {
        if (refreshInFlight.current) return;
        const task = refresh(snapshot).finally(() => {
          refreshInFlight.current = undefined;
        });
        refreshInFlight.current = task;
      });
    },
    [refresh],
  );

  const openRepository = useCallback(
    async (path: string) => {
      setState((current) => ({ ...current, loading: true, error: undefined }));
      try {
        const snapshot = await bridge.openRepository(path);
        await activateRepository(snapshot);
      } catch (error) {
        setState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    },
    [activateRepository],
  );

  const initializeRepository = useCallback(
    async (path: string, bare: boolean) => {
      setState((current) => ({ ...current, loading: true, error: undefined }));
      try {
        await activateRepository(await bridge.initializeRepository(path, bare));
      } catch (error) {
        setState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    },
    [activateRepository],
  );

  const cloneRepository = useCallback(
    async (url: string, path: string, depth: number | null) => {
      setState((current) => ({ ...current, loading: true, error: undefined }));
      try {
        await activateRepository(await bridge.cloneRepository(url, path, depth));
      } catch (error) {
        setState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    },
    [activateRepository],
  );

  const switchRepository = useCallback(
    async (repositoryId: string) => {
      const snapshot = state.openRepositories.find((repository) => repository.id === repositoryId);
      if (!snapshot || snapshot.id === state.repository.snapshot.id) return;
      setState((current) => ({ ...current, loading: true, error: undefined }));
      try {
        await activateRepository(snapshot);
      } catch (error) {
        setState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    },
    [activateRepository, state.openRepositories, state.repository.snapshot.id],
  );

  const executeOperation = useCallback(
    async (operation: GitOperation) => {
      const snapshot = state.repository.snapshot;
      setState((current) => ({ ...current, loading: true, error: undefined }));
      try {
        await runRequest({ kind: "operation", repositoryId: snapshot.id, operation });
        await refresh(snapshot);
      } catch (error) {
        setState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    },
    [refresh, runRequest, state.repository.snapshot],
  );

  const reload = useCallback(
    async () => refresh(state.repository.snapshot),
    [refresh, state.repository.snapshot],
  );

  const loadCommitFiles = useCallback(
    async (revision: string): Promise<readonly FileChange[]> =>
      parseCommitFiles(
        await runRequest({
          kind: "commitDetails",
          repositoryId: state.repository.snapshot.id,
          revision,
        }),
      ),
    [runRequest, state.repository.snapshot.id],
  );

  const loadCommitDiff = useCallback(
    async (commit: Commit, path: string): Promise<string> =>
      runRequest({
        kind: "diff",
        repositoryId: state.repository.snapshot.id,
        from: commit.parents[0] ?? "4b825dc642cb6eb9a060e54bf8d69288fbee4904",
        to: commit.oid,
        paths: [path],
        staged: false,
      }),
    [runRequest, state.repository.snapshot.id],
  );

  const loadWorkingDiff = useCallback(
    async (path: string, staged: boolean): Promise<string> =>
      runRequest({
        kind: "diff",
        repositoryId: state.repository.snapshot.id,
        from: null,
        to: null,
        paths: [path],
        staged,
      }),
    [runRequest, state.repository.snapshot.id],
  );

  const loadTree = useCallback(
    async (revision: string, path?: string): Promise<readonly TreeEntry[]> =>
      parseTree(
        await runRequest({
          kind: "tree",
          repositoryId: state.repository.snapshot.id,
          revision,
          path: path ?? null,
        }),
      ),
    [runRequest, state.repository.snapshot.id],
  );

  const loadFileHistory = useCallback(
    async (path: string): Promise<readonly Commit[]> =>
      parseFileHistory(
        await runRequest({
          kind: "fileHistory",
          repositoryId: state.repository.snapshot.id,
          path,
          skip: 0,
          limit: 500,
        }),
      ),
    [runRequest, state.repository.snapshot.id],
  );

  const loadBlame = useCallback(
    async (path: string, revision?: string): Promise<readonly BlameLine[]> =>
      parseBlame(
        await runRequest({
          kind: "blame",
          repositoryId: state.repository.snapshot.id,
          revision: revision ?? null,
          path,
        }),
      ),
    [runRequest, state.repository.snapshot.id],
  );

  const createShelf = useCallback(
    async (message: string, paths: readonly string[]) => {
      const snapshot = state.repository.snapshot;
      setState((current) => ({ ...current, loading: true, error: undefined }));
      try {
        await bridge.createShelf(snapshot.id, message, paths);
        await refresh(snapshot);
      } catch (error) {
        setState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    },
    [refresh, state.repository.snapshot],
  );

  const applyShelf = useCallback(
    async (shelfId: string, dropAfterApply: boolean) => {
      const snapshot = state.repository.snapshot;
      setState((current) => ({ ...current, loading: true, error: undefined }));
      try {
        await bridge.applyShelf(snapshot.id, shelfId, dropAfterApply);
        await refresh(snapshot);
      } catch (error) {
        setState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        }));
      }
    },
    [refresh, state.repository.snapshot],
  );

  const deleteShelf = useCallback(
    async (shelfId: string) => {
      const snapshot = state.repository.snapshot;
      await bridge.deleteShelf(snapshot.id, shelfId);
      setState((current) => ({
        ...current,
        shelves: current.shelves.filter((shelf) => shelf.id !== shelfId),
      }));
    },
    [state.repository.snapshot],
  );

  const saveChangelist = useCallback(
    async (id: string | null, name: string, paths: readonly string[]) => {
      const repositoryId = state.repository.snapshot.id;
      const saved = await bridge.saveChangelist(repositoryId, id, name, paths);
      setState((current) => ({
        ...current,
        changelists: [
          ...current.changelists.filter((changelist) => changelist.id !== saved.id),
          saved,
        ].sort((left, right) => left.createdAtMs - right.createdAtMs),
      }));
      return saved;
    },
    [state.repository.snapshot.id],
  );

  const deleteChangelist = useCallback(
    async (changelistId: string) => {
      const repositoryId = state.repository.snapshot.id;
      await bridge.deleteChangelist(repositoryId, changelistId);
      setState((current) => ({
        ...current,
        changelists: current.changelists.filter((changelist) => changelist.id !== changelistId),
      }));
    },
    [state.repository.snapshot.id],
  );

  const commitChangelist = useCallback(
    async (changelistId: string, message: string, amend: boolean) => {
      const snapshot = state.repository.snapshot;
      setState((current) => ({ ...current, loading: true, error: undefined }));
      try {
        const result = await bridge.commitChangelist(
          snapshot.id,
          changelistId,
          message,
          amend,
          false,
          false,
        );
        await refresh(snapshot);
        return result;
      } catch (error) {
        setState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        }));
        throw error;
      }
    },
    [refresh, state.repository.snapshot],
  );

  const restoreRecoveryEntry = useCallback(
    async (entryId: string) => {
      const snapshot = state.repository.snapshot;
      setState((current) => ({ ...current, loading: true, error: undefined }));
      try {
        const result = await bridge.restoreRecoveryEntry(snapshot.id, entryId);
        await refresh(snapshot);
        return result;
      } catch (error) {
        setState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        }));
        throw error;
      }
    },
    [refresh, state.repository.snapshot],
  );

  const readConflict = useCallback(
    (path: string): Promise<ConflictContent> =>
      bridge.readConflict(state.repository.snapshot.id, path),
    [state.repository.snapshot.id],
  );

  const saveConflictResult = useCallback(
    async (path: string, result: string, stage: boolean) => {
      const snapshot = state.repository.snapshot;
      setState((current) => ({ ...current, loading: true, error: undefined }));
      try {
        await bridge.writeConflictResult(snapshot.id, path, result, stage);
        await refresh(snapshot);
      } catch (error) {
        setState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        }));
        throw error;
      }
    },
    [refresh, state.repository.snapshot],
  );

  const resolveBinaryConflict = useCallback(
    async (path: string, side: "ours" | "theirs") => {
      const snapshot = state.repository.snapshot;
      setState((current) => ({ ...current, loading: true, error: undefined }));
      try {
        await bridge.resolveBinaryConflict(snapshot.id, path, side);
        await refresh(snapshot);
      } catch (error) {
        setState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : String(error),
        }));
        throw error;
      }
    },
    [refresh, state.repository.snapshot],
  );

  const executeSynchronizedBranchOperation = useCallback(
    async (repositoryIds: readonly string[], operation: GitOperation): Promise<MultiRootResult> => {
      const result = await bridge.executeSynchronizedBranchOperation(repositoryIds, operation);
      await refresh(state.repository.snapshot);
      return result;
    },
    [refresh, state.repository.snapshot],
  );

  const applyMultiRootRollback = useCallback(
    async (steps: readonly MultiRootRollbackStep[]): Promise<readonly MultiRootOutcome[]> => {
      const outcomes = await bridge.applyMultiRootRollback(steps);
      await refresh(state.repository.snapshot);
      return outcomes;
    },
    [refresh, state.repository.snapshot],
  );

  return useMemo(
    () => ({
      ...state,
      openRepository,
      initializeRepository,
      cloneRepository,
      switchRepository,
      reload,
      loadCommitFiles,
      loadCommitDiff,
      loadWorkingDiff,
      loadTree,
      loadFileHistory,
      loadBlame,
      executeOperation,
      createShelf,
      applyShelf,
      deleteShelf,
      saveChangelist,
      deleteChangelist,
      commitChangelist,
      restoreRecoveryEntry,
      readConflict,
      saveConflictResult,
      resolveBinaryConflict,
      executeSynchronizedBranchOperation,
      applyMultiRootRollback,
    }),
    [
      applyShelf,
      applyMultiRootRollback,
      cloneRepository,
      createShelf,
      deleteShelf,
      deleteChangelist,
      commitChangelist,
      executeOperation,
      executeSynchronizedBranchOperation,
      initializeRepository,
      loadCommitDiff,
      loadWorkingDiff,
      loadTree,
      loadFileHistory,
      loadBlame,
      loadCommitFiles,
      openRepository,
      reload,
      readConflict,
      resolveBinaryConflict,
      restoreRecoveryEntry,
      saveConflictResult,
      saveChangelist,
      switchRepository,
      state,
    ],
  );
}
