import type { DesktopApi } from "../../src/shared/contracts/desktop-api";
import { RPC_PROCEDURES } from "../../src/shared/contracts/desktop-rpc";
import {
  GitRepositoryServiceRequestSchema,
  GitRepositoryServiceResultSchema,
  type GitRepositoryServiceResult,
} from "../../src/shared/contracts/git-utility";
import { invokeDesktopRpc } from "./rpc-client";

type RepositoryServiceMethod =
  | "compareBranches"
  | "preCommitCheck"
  | "listGitConfig"
  | "listSubmodules"
  | "listMergedBranches"
  | "loadCommitSignature"
  | "listRemotes"
  | "listWorktrees"
  | "readIgnoreRules"
  | "writeIgnoreRules"
  | "loadPushPreview"
  | "loadHistoryRewritePreview"
  | "exportPatch"
  | "createPatchText"
  | "importPatch"
  | "createShelf"
  | "listShelves"
  | "applyShelf"
  | "deleteShelf"
  | "listChangelists"
  | "saveChangelist"
  | "deleteChangelist"
  | "commitChangelist"
  | "listRecoveryEntries"
  | "restoreRecoveryEntry"
  | "listLocalHistoryActivities"
  | "readLocalHistoryActivity"
  | "readLocalHistoryDiff"
  | "revertLocalHistory"
  | "createLocalHistoryPatch"
  | "putLocalHistoryLabel"
  | "listConflicts"
  | "readConflict"
  | "writeConflictResult"
  | "resolveBinaryConflict";

export async function invokeRepositoryService(
  untrustedRequest: unknown,
): Promise<GitRepositoryServiceResult> {
  const request = GitRepositoryServiceRequestSchema.parse(untrustedRequest);
  const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.gitRepositoryService, request);
  const result = GitRepositoryServiceResultSchema.parse(raw);
  if (result.operation !== request.operation) {
    throw new Error("Repository service result did not match its request");
  }
  return result;
}

export function createGitRepositoryServiceApi(): Pick<DesktopApi["git"], RepositoryServiceMethod> {
  return {
    async compareBranches(repositoryId, left, right) {
      const result = await invokeRepositoryService({
        operation: "compareBranches",
        repositoryId,
        left,
        right,
      });
      if (result.operation !== "compareBranches") throw new Error("Unexpected repository result");
      return result.value;
    },
    async preCommitCheck(repositoryId) {
      const result = await invokeRepositoryService({
        operation: "preCommitCheck",
        repositoryId,
      });
      if (result.operation !== "preCommitCheck") throw new Error("Unexpected repository result");
      return result.value;
    },
    async listGitConfig(repositoryId) {
      const result = await invokeRepositoryService({
        operation: "listGitConfig",
        repositoryId,
      });
      if (result.operation !== "listGitConfig") throw new Error("Unexpected repository result");
      return result.value;
    },
    async listSubmodules(repositoryId) {
      const result = await invokeRepositoryService({
        operation: "listSubmodules",
        repositoryId,
      });
      if (result.operation !== "listSubmodules") throw new Error("Unexpected repository result");
      return result.value;
    },
    async listMergedBranches(repositoryId, target) {
      const result = await invokeRepositoryService({
        operation: "listMergedBranches",
        repositoryId,
        target,
      });
      if (result.operation !== "listMergedBranches") {
        throw new Error("Unexpected repository result");
      }
      return result.value;
    },
    async loadCommitSignature(repositoryId, revision) {
      const result = await invokeRepositoryService({
        operation: "loadCommitSignature",
        repositoryId,
        revision,
      });
      if (result.operation !== "loadCommitSignature") {
        throw new Error("Unexpected repository result");
      }
      return result.value;
    },
    async listRemotes(repositoryId) {
      const result = await invokeRepositoryService({
        operation: "listRemotes",
        repositoryId,
      });
      if (result.operation !== "listRemotes") throw new Error("Unexpected repository result");
      return result.value;
    },
    async listWorktrees(repositoryId) {
      const result = await invokeRepositoryService({
        operation: "listWorktrees",
        repositoryId,
      });
      if (result.operation !== "listWorktrees") throw new Error("Unexpected repository result");
      return result.value;
    },
    async readIgnoreRules(repositoryId) {
      const result = await invokeRepositoryService({
        operation: "readIgnoreRules",
        repositoryId,
      });
      if (result.operation !== "readIgnoreRules") throw new Error("Unexpected repository result");
      return result.value;
    },
    async writeIgnoreRules(repositoryId, rules): Promise<void> {
      const result = await invokeRepositoryService({
        operation: "writeIgnoreRules",
        repositoryId,
        rules,
      });
      if (result.operation !== "writeIgnoreRules") {
        throw new Error("Unexpected repository result");
      }
    },
    async loadPushPreview(repositoryId, remote, remoteRef, localRevision) {
      const result = await invokeRepositoryService({
        operation: "pushPreview",
        repositoryId,
        remote,
        remoteRef,
        localRevision,
      });
      if (result.operation !== "pushPreview") {
        throw new Error("Unexpected repository result");
      }
      return result.value;
    },
    async loadHistoryRewritePreview(repositoryId, fromRevision) {
      const result = await invokeRepositoryService({
        operation: "historyRewritePreview",
        repositoryId,
        fromRevision,
      });
      if (result.operation !== "historyRewritePreview") {
        throw new Error("Unexpected repository result");
      }
      return result.value;
    },
    async exportPatch(repositoryId, revisions, targetPath) {
      const result = await invokeRepositoryService({
        operation: "exportPatch",
        repositoryId,
        revisions,
        targetPath,
      });
      if (result.operation !== "exportPatch") throw new Error("Unexpected repository result");
      return result.value;
    },
    async createPatchText(repositoryId, revisions) {
      const result = await invokeRepositoryService({
        operation: "createPatchText",
        repositoryId,
        revisions,
      });
      if (result.operation !== "createPatchText") throw new Error("Unexpected repository result");
      return result.value;
    },
    async importPatch(repositoryId, path): Promise<void> {
      const result = await invokeRepositoryService({
        operation: "importPatch",
        repositoryId,
        path,
      });
      if (result.operation !== "importPatch") throw new Error("Unexpected repository result");
    },
    async createShelf(repositoryId, message, paths) {
      const result = await invokeRepositoryService({
        operation: "createShelf",
        repositoryId,
        message,
        paths,
      });
      if (result.operation !== "createShelf") throw new Error("Unexpected repository result");
      return result.value;
    },
    async listShelves(repositoryId) {
      const result = await invokeRepositoryService({
        operation: "listShelves",
        repositoryId,
      });
      if (result.operation !== "listShelves") throw new Error("Unexpected repository result");
      return result.value;
    },
    async applyShelf(repositoryId, shelfId, dropAfterApply): Promise<void> {
      const result = await invokeRepositoryService({
        operation: "applyShelf",
        repositoryId,
        shelfId,
        dropAfterApply,
      });
      if (result.operation !== "applyShelf") throw new Error("Unexpected repository result");
    },
    async deleteShelf(repositoryId, shelfId): Promise<void> {
      const result = await invokeRepositoryService({
        operation: "deleteShelf",
        repositoryId,
        shelfId,
      });
      if (result.operation !== "deleteShelf") throw new Error("Unexpected repository result");
    },
    async listChangelists(repositoryId) {
      const result = await invokeRepositoryService({
        operation: "listChangelists",
        repositoryId,
      });
      if (result.operation !== "listChangelists") throw new Error("Unexpected repository result");
      return result.value;
    },
    async saveChangelist(repositoryId, id, name, paths) {
      const result = await invokeRepositoryService({
        operation: "saveChangelist",
        repositoryId,
        id,
        name,
        paths,
      });
      if (result.operation !== "saveChangelist") throw new Error("Unexpected repository result");
      return result.value;
    },
    async deleteChangelist(repositoryId, changelistId): Promise<void> {
      const result = await invokeRepositoryService({
        operation: "deleteChangelist",
        repositoryId,
        changelistId,
      });
      if (result.operation !== "deleteChangelist") throw new Error("Unexpected repository result");
    },
    async commitChangelist(repositoryId, changelistId, message, amend, signOff, gpgSign) {
      const result = await invokeRepositoryService({
        operation: "commitChangelist",
        repositoryId,
        changelistId,
        message,
        amend,
        signOff,
        gpgSign,
      });
      if (result.operation !== "commitChangelist") throw new Error("Unexpected repository result");
      return result.value;
    },
    async listRecoveryEntries(repositoryId) {
      const result = await invokeRepositoryService({
        operation: "listRecoveryEntries",
        repositoryId,
      });
      if (result.operation !== "listRecoveryEntries")
        throw new Error("Unexpected repository result");
      return result.value;
    },
    async restoreRecoveryEntry(repositoryId, entryId) {
      const result = await invokeRepositoryService({
        operation: "restoreRecoveryEntry",
        repositoryId,
        entryId,
      });
      if (result.operation !== "restoreRecoveryEntry")
        throw new Error("Unexpected repository result");
      return result.value;
    },
    async listLocalHistoryActivities(scope, cursor, limit, query, showSystemEvents) {
      const result = await invokeRepositoryService({
        operation: "listLocalHistoryActivities",
        scope,
        cursor,
        limit,
        query,
        showSystemEvents,
      });
      if (result.operation !== "listLocalHistoryActivities")
        throw new Error("Unexpected repository result");
      return result.value;
    },
    async readLocalHistoryActivity(repositoryId, activityId) {
      const result = await invokeRepositoryService({
        operation: "readLocalHistoryActivity",
        repositoryId,
        activityId,
      });
      if (result.operation !== "readLocalHistoryActivity")
        throw new Error("Unexpected repository result");
      return result.value;
    },
    async readLocalHistoryDiff(repositoryId, activityId, path) {
      const result = await invokeRepositoryService({
        operation: "readLocalHistoryDiff",
        repositoryId,
        activityId,
        path,
      });
      if (result.operation !== "readLocalHistoryDiff")
        throw new Error("Unexpected repository result");
      return result.value;
    },
    async revertLocalHistory(repositoryId, activityId, paths, includeLater) {
      const result = await invokeRepositoryService({
        operation: "revertLocalHistory",
        repositoryId,
        activityId,
        paths,
        includeLater,
      });
      if (result.operation !== "revertLocalHistory")
        throw new Error("Unexpected repository result");
    },
    async createLocalHistoryPatch(repositoryId, activityId, paths) {
      const result = await invokeRepositoryService({
        operation: "createLocalHistoryPatch",
        repositoryId,
        activityId,
        paths,
      });
      if (result.operation !== "createLocalHistoryPatch")
        throw new Error("Unexpected repository result");
      return result.value;
    },
    async putLocalHistoryLabel(repositoryId, label) {
      const result = await invokeRepositoryService({
        operation: "putLocalHistoryLabel",
        repositoryId,
        label,
      });
      if (result.operation !== "putLocalHistoryLabel")
        throw new Error("Unexpected repository result");
      return result.value;
    },
    async listConflicts(repositoryId) {
      const result = await invokeRepositoryService({
        operation: "listConflicts",
        repositoryId,
      });
      if (result.operation !== "listConflicts") throw new Error("Unexpected repository result");
      return result.value;
    },
    async readConflict(repositoryId, path) {
      const result = await invokeRepositoryService({
        operation: "readConflict",
        repositoryId,
        path,
      });
      if (result.operation !== "readConflict") throw new Error("Unexpected repository result");
      return result.value;
    },
    async writeConflictResult(repositoryId, path, conflictResult, stage): Promise<void> {
      const result = await invokeRepositoryService({
        operation: "writeConflictResult",
        repositoryId,
        path,
        result: conflictResult,
        stage,
      });
      if (result.operation !== "writeConflictResult")
        throw new Error("Unexpected repository result");
    },
    async resolveBinaryConflict(repositoryId, path, side): Promise<void> {
      const result = await invokeRepositoryService({
        operation: "resolveBinaryConflict",
        repositoryId,
        path,
        side,
      });
      if (result.operation !== "resolveBinaryConflict")
        throw new Error("Unexpected repository result");
    },
  };
}
