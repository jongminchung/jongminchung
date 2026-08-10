import { useCallback } from "react";
import type { GitBridge } from "../bridge/GitBridge";
import { operationPolicyFor } from "../domain/gitOperationPolicy";
import { repositoryAccessPolicy } from "../domain/repositoryAccess";
import type {
  AbortableOperation,
  BranchComparison,
  Changelist,
  ChangelistCommitResult,
  CommitSignature,
  ConflictContent,
  GitConfig,
  GitOperation,
  IgnoreRules,
  MultiRootOutcome,
  MultiRootResult,
  MultiRootRollbackStep,
  PreCommitCheck,
  RepositoryInvalidation,
  RepositorySnapshot,
  SubmoduleInfo,
} from "../shared/contracts/model";
import type { GitSessionStore } from "./gitSessionStore";
import type { RepositorySession, WorkspaceState } from "./sessionTypes";

const EMPTY_ARRAY: readonly never[] = [];

function updateRepositorySession(
  state: WorkspaceState,
  repositoryId: string,
  update: (session: RepositorySession) => RepositorySession,
): WorkspaceState {
  let changed = false;
  const sessions = state.sessions.map((session) => {
    if (session.kind !== "repository" || session.repository.snapshot.id !== repositoryId) {
      return session;
    }
    const next = update(session);
    if (next !== session) changed = true;
    return next;
  });
  return changed ? { ...state, sessions } : state;
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

interface GitSessionMutationDependencies {
  readonly activeSession: RepositorySession | null;
  readonly activeSnapshot: () => RepositorySnapshot;
  readonly executeOperation: (operation: GitOperation, suppressRecovery?: boolean) => Promise<void>;
  readonly fixture: boolean;
  readonly gitBridge: GitBridge;
  readonly refreshCoordinator: GitSessionStore["refreshCoordinator"];
  readonly setState: GitSessionStore["setWorkspace"];
}

export function useGitSessionMutationActions({
  activeSession,
  activeSnapshot,
  executeOperation,
  fixture,
  gitBridge,
  refreshCoordinator,
  setState,
}: GitSessionMutationDependencies) {
  const mutateAndRefresh = useCallback(
    async (
      mutation: (repositoryId: string) => Promise<unknown>,
      invalidations: readonly RepositoryInvalidation[],
    ): Promise<void> => {
      const snapshot = activeSnapshot();
      repositoryAccessPolicy.assert(snapshot.id, "gitMutation");
      await mutation(snapshot.id);
      refreshCoordinator.invalidate(snapshot.id, invalidations);
      await refreshCoordinator.flush(snapshot.id);
    },
    [activeSnapshot, refreshCoordinator],
  );

  const createShelf = useCallback(
    async (message: string, paths: readonly string[]): Promise<void> => {
      if (fixture) return;
      const snapshot = activeSnapshot();
      repositoryAccessPolicy.assert(snapshot.id, "gitMutation");
      const shelf = await gitBridge.createShelf(snapshot.id, message, paths);
      setState((current) =>
        updateRepositorySession(current, snapshot.id, (session) => ({
          ...session,
          shelves: [shelf, ...session.shelves.filter((item) => item.id !== shelf.id)],
        })),
      );
      refreshCoordinator.invalidate(snapshot.id, ["status"]);
      await refreshCoordinator.flush(snapshot.id);
    },
    [activeSnapshot, fixture, refreshCoordinator, gitBridge, setState],
  );

  const applyShelf = useCallback(
    async (shelfId: string, dropAfterApply: boolean): Promise<void> => {
      if (fixture) return;
      const snapshot = activeSnapshot();
      repositoryAccessPolicy.assert(snapshot.id, "gitMutation");
      await gitBridge.applyShelf(snapshot.id, shelfId, dropAfterApply);
      if (dropAfterApply) {
        setState((current) =>
          updateRepositorySession(current, snapshot.id, (session) => ({
            ...session,
            shelves: session.shelves.filter((shelf) => shelf.id !== shelfId),
          })),
        );
      }
      refreshCoordinator.invalidate(snapshot.id, ["status"]);
      await refreshCoordinator.flush(snapshot.id);
    },
    [activeSnapshot, fixture, refreshCoordinator, gitBridge, setState],
  );

  const deleteShelf = useCallback(
    async (shelfId: string): Promise<void> => {
      const snapshot = activeSnapshot();
      repositoryAccessPolicy.assert(snapshot.id, "gitMutation");
      await gitBridge.deleteShelf(snapshot.id, shelfId);
      setState((current) =>
        updateRepositorySession(current, snapshot.id, (session) => ({
          ...session,
          shelves: session.shelves.filter((shelf) => shelf.id !== shelfId),
        })),
      );
    },
    [activeSnapshot, gitBridge, setState],
  );

  const saveChangelist = useCallback(
    async (id: string | null, name: string, paths: readonly string[]): Promise<Changelist> => {
      const snapshot = activeSnapshot();
      repositoryAccessPolicy.assert(snapshot.id, "gitMutation");
      const saved = await gitBridge.saveChangelist(snapshot.id, id, name, paths);
      setState((current) =>
        updateRepositorySession(current, snapshot.id, (session) => ({
          ...session,
          changelists: [
            ...session.changelists.filter((changelist) => changelist.id !== saved.id),
            saved,
          ].sort((left, right) => left.createdAtMs - right.createdAtMs),
        })),
      );
      return saved;
    },
    [activeSnapshot, gitBridge, setState],
  );

  const deleteChangelist = useCallback(
    async (changelistId: string): Promise<void> => {
      const snapshot = activeSnapshot();
      repositoryAccessPolicy.assert(snapshot.id, "gitMutation");
      await gitBridge.deleteChangelist(snapshot.id, changelistId);
      setState((current) =>
        updateRepositorySession(current, snapshot.id, (session) => ({
          ...session,
          changelists: session.changelists.filter((changelist) => changelist.id !== changelistId),
        })),
      );
    },
    [activeSnapshot, gitBridge, setState],
  );

  const commitChangelist = useCallback(
    async (
      changelistId: string,
      message: string,
      amend: boolean,
      signOff: boolean,
      gpgSign: boolean,
    ): Promise<ChangelistCommitResult> => {
      const snapshot = activeSnapshot();
      repositoryAccessPolicy.assert(snapshot.id, "gitMutation");
      const result = await gitBridge.commitChangelist(
        snapshot.id,
        changelistId,
        message,
        amend,
        signOff,
        gpgSign,
      );
      refreshCoordinator.invalidate(snapshot.id, ["status", "history"]);
      await refreshCoordinator.flush(snapshot.id);
      return result;
    },
    [activeSnapshot, refreshCoordinator, gitBridge],
  );

  const preCommitCheck = useCallback(async (): Promise<PreCommitCheck> => {
    const snapshot = activeSnapshot();
    return gitBridge.preCommitCheck(snapshot.id);
  }, [activeSnapshot, gitBridge]);

  const loadGitConfig = useCallback(async (): Promise<readonly GitConfig[]> => {
    return gitBridge.listGitConfig(activeSnapshot().id);
  }, [activeSnapshot, gitBridge]);

  const loadSubmodules = useCallback(async (): Promise<readonly SubmoduleInfo[]> => {
    return gitBridge.listSubmodules(activeSnapshot().id);
  }, [activeSnapshot, gitBridge]);

  const loadMergedBranches = useCallback(
    async (target: string): Promise<readonly string[]> => {
      return gitBridge.listMergedBranches(activeSnapshot().id, target);
    },
    [activeSnapshot, gitBridge],
  );

  const readIgnoreRules = useCallback(async (): Promise<IgnoreRules> => {
    return gitBridge.readIgnoreRules(activeSnapshot().id);
  }, [activeSnapshot, gitBridge]);

  const writeIgnoreRules = useCallback(
    async (rules: IgnoreRules): Promise<void> => {
      const snapshot = activeSnapshot();
      repositoryAccessPolicy.assert(snapshot.id, "gitMutation");
      await gitBridge.writeIgnoreRules(snapshot.id, rules);
      refreshCoordinator.invalidate(snapshot.id, ["status"]);
      await refreshCoordinator.flush(snapshot.id);
    },
    [activeSnapshot, refreshCoordinator, gitBridge],
  );

  const compareBranches = useCallback(
    async (left: string, right: string): Promise<BranchComparison> => {
      return gitBridge.compareBranches(activeSnapshot().id, left, right);
    },
    [activeSnapshot, gitBridge],
  );

  const loadCommitSignature = useCallback(
    async (revision: string): Promise<CommitSignature> => {
      return gitBridge.loadCommitSignature(activeSnapshot().id, revision);
    },
    [activeSnapshot, gitBridge],
  );

  const restoreRecoveryEntry = useCallback(
    async (entryId: string): Promise<void> => {
      const snapshot = activeSnapshot();
      repositoryAccessPolicy.assert(snapshot.id, "gitMutation");
      await gitBridge.restoreRecoveryEntry(snapshot.id, entryId);
      refreshCoordinator.invalidate(snapshot.id, ["status", "history"]);
      const [recoveryEntries] = await Promise.all([
        gitBridge.listRecoveryEntries(snapshot.id),
        refreshCoordinator.flush(snapshot.id),
      ]);
      setState((current) =>
        updateRepositorySession(current, snapshot.id, (session) =>
          sameValue(recoveryEntries, session.recoveryEntries)
            ? session
            : { ...session, recoveryEntries },
        ),
      );
    },
    [activeSnapshot, refreshCoordinator, gitBridge, setState],
  );

  const abortOperation = useCallback(
    async (operation: AbortableOperation): Promise<void> => {
      const snapshot = activeSnapshot();
      const recoveryOperation = operation === "cherryPick" ? "cherry-pick" : operation;
      const recoveryEntries = fixture
        ? EMPTY_ARRAY
        : await gitBridge.listRecoveryEntries(snapshot.id);
      const recoveryEntry = recoveryEntries.find(
        (entry) => entry.recoverable && entry.operation === recoveryOperation,
      );
      await executeOperation({ kind: "abort", operation }, true);
      if (recoveryEntry) await restoreRecoveryEntry(recoveryEntry.id);
    },
    [activeSnapshot, executeOperation, fixture, gitBridge, restoreRecoveryEntry],
  );

  const readConflict = useCallback(
    async (path: string): Promise<ConflictContent> =>
      gitBridge.readConflict(activeSnapshot().id, path),
    [activeSnapshot, gitBridge],
  );

  const saveConflictResult = useCallback(
    async (path: string, result: string, stage: boolean): Promise<void> => {
      await mutateAndRefresh(
        (repositoryId) => gitBridge.writeConflictResult(repositoryId, path, result, stage),
        ["status", "operation"],
      );
    },
    [mutateAndRefresh, gitBridge],
  );

  const resolveBinaryConflict = useCallback(
    async (path: string, side: "ours" | "theirs"): Promise<void> => {
      await mutateAndRefresh(
        (repositoryId) => gitBridge.resolveBinaryConflict(repositoryId, path, side),
        ["status", "operation"],
      );
    },
    [mutateAndRefresh, gitBridge],
  );

  const executeSynchronizedBranchOperation = useCallback(
    async (repositoryIds: readonly string[], operation: GitOperation): Promise<MultiRootResult> => {
      for (const repositoryId of repositoryIds) {
        repositoryAccessPolicy.assert(repositoryId, "gitMutation");
      }
      const result = await gitBridge.executeSynchronizedBranchOperation(repositoryIds, operation);
      if (activeSession) {
        const repositoryId = activeSession.repository.snapshot.id;
        refreshCoordinator.invalidate(repositoryId, operationPolicyFor(operation).invalidations);
        await refreshCoordinator.flush(repositoryId);
      }
      return result;
    },
    [activeSession, refreshCoordinator, gitBridge],
  );

  const applyMultiRootRollback = useCallback(
    async (steps: readonly MultiRootRollbackStep[]): Promise<readonly MultiRootOutcome[]> => {
      for (const step of steps) {
        repositoryAccessPolicy.assert(step.repositoryId, "gitMutation");
      }
      const outcomes = await gitBridge.applyMultiRootRollback(steps);
      if (activeSession) {
        const repositoryId = activeSession.repository.snapshot.id;
        refreshCoordinator.invalidate(repositoryId, ["status", "history", "management"]);
        await refreshCoordinator.flush(repositoryId);
      }
      return outcomes;
    },
    [activeSession, refreshCoordinator, gitBridge],
  );

  return {
    createShelf,
    applyShelf,
    deleteShelf,
    saveChangelist,
    deleteChangelist,
    commitChangelist,
    preCommitCheck,
    loadGitConfig,
    loadSubmodules,
    loadMergedBranches,
    readIgnoreRules,
    writeIgnoreRules,
    compareBranches,
    loadCommitSignature,
    restoreRecoveryEntry,
    abortOperation,
    readConflict,
    saveConflictResult,
    resolveBinaryConflict,
    executeSynchronizedBranchOperation,
    applyMultiRootRollback,
  };
}
