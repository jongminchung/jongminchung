import type {
    GitRepositoryServiceRequest,
    GitRepositoryServiceResult,
    RepositoryId,
} from "../../../src/shared/contracts/git-utility";
import { GitSubmoduleInfosSchema } from "../../../src/shared/contracts/git-utility";
import type { ChangelistService } from "./changelist-service";
import type { GitConflictService } from "./conflict-service";
import { GitUtilityError } from "./git-error";
import type { IgnoreRulesService } from "./ignore-rules-service";
import type { LocalHistoryService } from "./local-history-service";
import type { MultiRootService } from "./multi-root-service";
import type { PatchService } from "./patch-service";
import type { GitPreviewService } from "./preview-service";
import type { RecoveryService } from "./recovery-service";
import type { RepositoryInspectionService } from "./repository-inspection-service";
import type { ShelfService } from "./shelf-service";
import type { SubmoduleDiffService } from "./submodule-diff-service";
import type { WorkingTreeFileResolver } from "./working-tree-file-resolver";

export interface RepositoryServiceDependencies {
    readonly inspection: RepositoryInspectionService;
    readonly ignoreRules: IgnoreRulesService;
    readonly previews: GitPreviewService;
    readonly patches: PatchService;
    readonly shelves: ShelfService | null;
    readonly changelists: ChangelistService | null;
    readonly recovery: RecoveryService | null;
    readonly localHistory: LocalHistoryService | null;
    readonly conflicts: GitConflictService;
    readonly submoduleDiff: SubmoduleDiffService;
    readonly workingTreeFiles: WorkingTreeFileResolver;
    readonly multiRoot: MultiRootService | null;
}

function stored<T>(service: T | null): T {
    if (service !== null) return service;
    throw new GitUtilityError(
        "invalidInput",
        "Persistent Git service storage is not configured",
    );
}

export function repositoryServiceIds(
    request: GitRepositoryServiceRequest,
): readonly RepositoryId[] {
    if (request.operation === "executeSynchronizedBranchOperation") {
        return [...new Set(request.repositoryIds)];
    }
    if (request.operation === "applyMultiRootRollback") {
        return [...new Set(request.steps.map((step) => step.repositoryId))];
    }
    if (request.operation === "listLocalHistoryActivities") {
        return [request.scope.repositoryId];
    }
    return [request.repositoryId];
}

export function repositoryServiceIsMutation(
    operation: GitRepositoryServiceRequest["operation"],
): boolean {
    switch (operation) {
        case "writeIgnoreRules":
        case "importPatch":
        case "createShelf":
        case "applyShelf":
        case "deleteShelf":
        case "saveChangelist":
        case "deleteChangelist":
        case "commitChangelist":
        case "restoreRecoveryEntry":
        case "revertLocalHistory":
        case "putLocalHistoryLabel":
        case "writeConflictResult":
        case "resolveBinaryConflict":
        case "executeSynchronizedBranchOperation":
        case "applyMultiRootRollback":
            return true;
        case "compareBranches":
        case "preCommitCheck":
        case "listGitConfig":
        case "listSubmodules":
        case "listMergedBranches":
        case "loadCommitSignature":
        case "listRemotes":
        case "listWorktrees":
        case "readIgnoreRules":
        case "pushPreview":
        case "historyRewritePreview":
        case "exportPatch":
        case "createPatchText":
        case "listShelves":
        case "listChangelists":
        case "listRecoveryEntries":
        case "listLocalHistoryActivities":
        case "readLocalHistoryActivity":
        case "readLocalHistoryDiff":
        case "createLocalHistoryPatch":
        case "listConflicts":
        case "readConflict":
        case "loadSubmoduleDiff":
        case "resolveWorkingTreeFile":
            return false;
        default: {
            const unhandled: never = operation;
            return unhandled;
        }
    }
}

export async function dispatchRepositoryService(
    request: GitRepositoryServiceRequest,
    signal: AbortSignal,
    dependencies: RepositoryServiceDependencies,
): Promise<GitRepositoryServiceResult> {
    switch (request.operation) {
        case "compareBranches":
            return {
                operation: request.operation,
                value: await dependencies.inspection.compareBranches(
                    request.repositoryId,
                    request.left,
                    request.right,
                ),
            };
        case "preCommitCheck":
            return {
                operation: request.operation,
                value: await dependencies.inspection.preCommitCheck(
                    request.repositoryId,
                ),
            };
        case "listGitConfig":
            return {
                operation: request.operation,
                value: await dependencies.inspection.listGitConfig(
                    request.repositoryId,
                ),
            };
        case "listSubmodules":
            return {
                operation: request.operation,
                value: GitSubmoduleInfosSchema.parse(
                    await dependencies.inspection.listSubmodules(
                        request.repositoryId,
                    ),
                ),
            };
        case "listMergedBranches":
            return {
                operation: request.operation,
                value: await dependencies.inspection.listMergedBranches(
                    request.repositoryId,
                    request.target,
                ),
            };
        case "loadCommitSignature":
            return {
                operation: request.operation,
                value: await dependencies.inspection.loadCommitSignature(
                    request.repositoryId,
                    request.revision,
                ),
            };
        case "listRemotes":
            return {
                operation: request.operation,
                value: await dependencies.inspection.listRemotes(
                    request.repositoryId,
                ),
            };
        case "listWorktrees":
            return {
                operation: request.operation,
                value: await dependencies.inspection.listWorktrees(
                    request.repositoryId,
                ),
            };
        case "readIgnoreRules":
            return {
                operation: request.operation,
                value: await dependencies.ignoreRules.read(
                    request.repositoryId,
                ),
            };
        case "writeIgnoreRules":
            await dependencies.ignoreRules.write(
                request.repositoryId,
                request.rules,
            );
            return { operation: request.operation };
        case "pushPreview":
            return {
                operation: request.operation,
                value: await dependencies.previews.pushPreview(
                    request.repositoryId,
                    request.remote,
                    request.remoteRef,
                    request.localRevision,
                ),
            };
        case "historyRewritePreview":
            return {
                operation: request.operation,
                value: await dependencies.previews.historyRewritePreview(
                    request.repositoryId,
                    request.fromRevision,
                ),
            };
        case "exportPatch":
            return {
                operation: request.operation,
                value: await dependencies.patches.exportPatch(
                    request.repositoryId,
                    request.revisions,
                    request.targetPath,
                    signal,
                ),
            };
        case "createPatchText":
            return {
                operation: request.operation,
                value: await dependencies.patches.createPatchText(
                    request.repositoryId,
                    request.revisions,
                    signal,
                ),
            };
        case "importPatch":
            await dependencies.patches.importPatch(
                request.repositoryId,
                request.path,
                signal,
            );
            return { operation: request.operation };
        case "createShelf":
            return {
                operation: request.operation,
                value: await stored(dependencies.shelves).create(
                    request.repositoryId,
                    request.message,
                    request.paths,
                    signal,
                ),
            };
        case "listShelves":
            return {
                operation: request.operation,
                value: await stored(dependencies.shelves).list(
                    request.repositoryId,
                ),
            };
        case "applyShelf":
            await stored(dependencies.shelves).apply(
                request.repositoryId,
                request.shelfId,
                request.dropAfterApply,
                signal,
            );
            return { operation: request.operation };
        case "deleteShelf":
            await stored(dependencies.shelves).delete(
                request.repositoryId,
                request.shelfId,
            );
            return { operation: request.operation };
        case "listChangelists":
            return {
                operation: request.operation,
                value: await stored(dependencies.changelists).list(
                    request.repositoryId,
                    signal,
                ),
            };
        case "saveChangelist":
            return {
                operation: request.operation,
                value: await stored(dependencies.changelists).save(
                    request.repositoryId,
                    request.id,
                    request.name,
                    request.paths,
                    signal,
                ),
            };
        case "deleteChangelist":
            await stored(dependencies.changelists).delete(
                request.repositoryId,
                request.changelistId,
                signal,
            );
            return { operation: request.operation };
        case "commitChangelist":
            await stored(dependencies.recovery).recordBeforeOperation(
                request.repositoryId,
                {
                    kind: "commit",
                    message: request.message,
                    amend: request.amend,
                    signOff: request.signOff,
                    gpgSign: request.gpgSign,
                },
                signal,
            );
            return {
                operation: request.operation,
                value: await stored(dependencies.changelists).commit(
                    request.repositoryId,
                    request.changelistId,
                    {
                        message: request.message,
                        amend: request.amend,
                        signOff: request.signOff,
                        gpgSign: request.gpgSign,
                    },
                    signal,
                ),
            };
        case "listRecoveryEntries":
            return {
                operation: request.operation,
                value: await stored(dependencies.recovery).list(
                    request.repositoryId,
                    signal,
                ),
            };
        case "restoreRecoveryEntry":
            return {
                operation: request.operation,
                value: await stored(dependencies.recovery).restore(
                    request.repositoryId,
                    request.entryId,
                    signal,
                ),
            };
        case "listLocalHistoryActivities":
            return {
                operation: request.operation,
                value: await stored(dependencies.localHistory).list(
                    request.scope,
                    request.cursor,
                    request.limit,
                    request.query,
                    request.showSystemEvents,
                ),
            };
        case "readLocalHistoryActivity":
            return {
                operation: request.operation,
                value: await stored(dependencies.localHistory).detail(
                    request.repositoryId,
                    request.activityId,
                ),
            };
        case "readLocalHistoryDiff":
            return {
                operation: request.operation,
                value: await stored(dependencies.localHistory).diff(
                    request.repositoryId,
                    request.activityId,
                    request.path,
                    signal,
                ),
            };
        case "revertLocalHistory":
            await stored(dependencies.localHistory).revert(
                request.repositoryId,
                request.activityId,
                request.paths,
                request.includeLater,
                signal,
            );
            return { operation: request.operation };
        case "createLocalHistoryPatch":
            return {
                operation: request.operation,
                value: await stored(dependencies.localHistory).createPatch(
                    request.repositoryId,
                    request.activityId,
                    request.paths,
                    signal,
                ),
            };
        case "putLocalHistoryLabel":
            return {
                operation: request.operation,
                value: await stored(dependencies.localHistory).putLabel(
                    request.repositoryId,
                    request.label,
                ),
            };
        case "listConflicts":
            return {
                operation: request.operation,
                value: await dependencies.conflicts.list(
                    request.repositoryId,
                    signal,
                ),
            };
        case "readConflict":
            return {
                operation: request.operation,
                value: await dependencies.conflicts.read(
                    request.repositoryId,
                    request.path,
                    signal,
                ),
            };
        case "writeConflictResult":
            await dependencies.conflicts.write(
                request.repositoryId,
                request.path,
                request.result,
                request.stage,
                signal,
            );
            return { operation: request.operation };
        case "resolveBinaryConflict":
            await dependencies.conflicts.resolveBinary(
                request.repositoryId,
                request.path,
                request.side,
                signal,
            );
            return { operation: request.operation };
        case "loadSubmoduleDiff":
            return {
                operation: request.operation,
                value: (
                    await dependencies.submoduleDiff.loadSubmoduleDiff(
                        request.repositoryId,
                        request.before,
                        request.after,
                        request.path,
                        signal,
                    )
                ).diff,
            };
        case "resolveWorkingTreeFile":
            return {
                operation: request.operation,
                value: await dependencies.workingTreeFiles.resolve(
                    request.repositoryId,
                    request.path,
                ),
            };
        case "executeSynchronizedBranchOperation":
            return {
                operation: request.operation,
                value: await stored(
                    dependencies.multiRoot,
                ).executeSynchronizedBranchOperation(
                    request.repositoryIds,
                    request.gitOperation,
                    signal,
                ),
            };
        case "applyMultiRootRollback":
            return {
                operation: request.operation,
                value: await stored(
                    dependencies.multiRoot,
                ).applyMultiRootRollback(request.steps, signal),
            };
    }
}
