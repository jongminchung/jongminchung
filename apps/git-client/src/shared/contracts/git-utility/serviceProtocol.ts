import { z } from "zod";
import { GitRequestIdSchema, RepositoryIdSchema } from "../git-identifiers";
import {
    FileSourceSchema,
    GitAbsolutePathSchema,
    GitConflictResultSchema,
    GitRelativePathSchema,
    GitRevisionSchema,
    GitServiceMessageSchema,
    GitSubmoduleDiffSchema,
    GitUuidSchema,
    RepositoryRecordSchema,
} from "./repositoryCommon";
import {
    GitBranchComparisonSchema,
    GitChangelistCommitResultSchema,
    GitChangelistSchema,
    GitChangelistsSchema,
    GitCommitSignatureSchema,
    GitConfigEntriesSchema,
    GitConflictContentSchema,
    GitConflictFilesSchema,
    GitHistoryRewritePreviewSchema,
    GitIgnoreRulesSchema,
    GitLocalHistoryActivitiesPageSchema,
    GitLocalHistoryActivityDetailSchema,
    GitLocalHistoryActivitySchema,
    GitLocalHistoryScopeSchema,
    GitMultiRootOutcomeSchema,
    GitMultiRootResultSchema,
    GitMultiRootRollbackStepSchema,
    GitPatchExportResultSchema,
    GitPreCommitCheckSchema,
    GitPushPreviewSchema,
    GitRecoveryEntriesSchema,
    GitRecoveryRestoreResultSchema,
    GitRemoteInfosSchema,
    GitShelfEntriesSchema,
    GitShelfEntrySchema,
    GitSubmoduleInfosSchema,
    GitSynchronizedBranchOperationSchema,
    GitWorktreeInfosSchema,
} from "./repositoryFeatures";

export const GitRepositoryServiceRequestSchema = z
    .discriminatedUnion("operation", [
        z
            .object({
                operation: z.literal("compareBranches"),
                repositoryId: RepositoryIdSchema,
                left: GitRevisionSchema,
                right: GitRevisionSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("preCommitCheck"),
                repositoryId: RepositoryIdSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("listGitConfig"),
                repositoryId: RepositoryIdSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("listSubmodules"),
                repositoryId: RepositoryIdSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("listMergedBranches"),
                repositoryId: RepositoryIdSchema,
                target: GitRevisionSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("loadCommitSignature"),
                repositoryId: RepositoryIdSchema,
                revision: GitRevisionSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("listRemotes"),
                repositoryId: RepositoryIdSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("listWorktrees"),
                repositoryId: RepositoryIdSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("readIgnoreRules"),
                repositoryId: RepositoryIdSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("writeIgnoreRules"),
                repositoryId: RepositoryIdSchema,
                rules: GitIgnoreRulesSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("pushPreview"),
                repositoryId: RepositoryIdSchema,
                remote: z.string().min(1).max(512).nullable(),
                remoteRef: z.string().min(1).max(512).nullable(),
                localRevision: GitRevisionSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("historyRewritePreview"),
                repositoryId: RepositoryIdSchema,
                fromRevision: GitRevisionSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("exportPatch"),
                repositoryId: RepositoryIdSchema,
                revisions: z
                    .array(GitRevisionSchema)
                    .min(1)
                    .max(500)
                    .readonly(),
                targetPath: GitAbsolutePathSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("createPatchText"),
                repositoryId: RepositoryIdSchema,
                revisions: z
                    .array(GitRevisionSchema)
                    .min(1)
                    .max(500)
                    .readonly(),
            })
            .strict(),
        z
            .object({
                operation: z.literal("importPatch"),
                repositoryId: RepositoryIdSchema,
                path: GitAbsolutePathSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("createShelf"),
                repositoryId: RepositoryIdSchema,
                message: GitServiceMessageSchema,
                paths: z
                    .array(GitRelativePathSchema)
                    .min(1)
                    .max(10_000)
                    .readonly(),
            })
            .strict(),
        z
            .object({
                operation: z.literal("listShelves"),
                repositoryId: RepositoryIdSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("applyShelf"),
                repositoryId: RepositoryIdSchema,
                shelfId: GitUuidSchema,
                dropAfterApply: z.boolean(),
            })
            .strict(),
        z
            .object({
                operation: z.literal("deleteShelf"),
                repositoryId: RepositoryIdSchema,
                shelfId: GitUuidSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("listChangelists"),
                repositoryId: RepositoryIdSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("saveChangelist"),
                repositoryId: RepositoryIdSchema,
                id: GitUuidSchema.nullable(),
                name: GitServiceMessageSchema,
                paths: z.array(GitRelativePathSchema).max(10_000).readonly(),
            })
            .strict(),
        z
            .object({
                operation: z.literal("deleteChangelist"),
                repositoryId: RepositoryIdSchema,
                changelistId: GitUuidSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("commitChangelist"),
                repositoryId: RepositoryIdSchema,
                changelistId: GitUuidSchema,
                message: GitServiceMessageSchema,
                amend: z.boolean(),
                signOff: z.boolean(),
                gpgSign: z.boolean(),
            })
            .strict(),
        z
            .object({
                operation: z.literal("listRecoveryEntries"),
                repositoryId: RepositoryIdSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("restoreRecoveryEntry"),
                repositoryId: RepositoryIdSchema,
                entryId: GitUuidSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("listLocalHistoryActivities"),
                scope: GitLocalHistoryScopeSchema,
                cursor: z.string().min(1).max(256).nullable(),
                limit: z.number().int().min(1).max(500),
                query: z.string().max(16_384),
                showSystemEvents: z.boolean(),
            })
            .strict(),
        z
            .object({
                operation: z.literal("readLocalHistoryActivity"),
                repositoryId: RepositoryIdSchema,
                activityId: GitUuidSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("readLocalHistoryDiff"),
                repositoryId: RepositoryIdSchema,
                activityId: GitUuidSchema,
                path: GitRelativePathSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("revertLocalHistory"),
                repositoryId: RepositoryIdSchema,
                activityId: GitUuidSchema,
                paths: z
                    .array(GitRelativePathSchema)
                    .min(1)
                    .max(20_000)
                    .readonly(),
                includeLater: z.boolean(),
            })
            .strict(),
        z
            .object({
                operation: z.literal("createLocalHistoryPatch"),
                repositoryId: RepositoryIdSchema,
                activityId: GitUuidSchema,
                paths: z.array(GitRelativePathSchema).max(20_000).readonly(),
            })
            .strict(),
        z
            .object({
                operation: z.literal("putLocalHistoryLabel"),
                repositoryId: RepositoryIdSchema,
                label: z.string().min(1).max(16_384),
            })
            .strict(),
        z
            .object({
                operation: z.literal("listConflicts"),
                repositoryId: RepositoryIdSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("readConflict"),
                repositoryId: RepositoryIdSchema,
                path: GitRelativePathSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("writeConflictResult"),
                repositoryId: RepositoryIdSchema,
                path: GitRelativePathSchema,
                result: GitConflictResultSchema,
                stage: z.boolean(),
            })
            .strict(),
        z
            .object({
                operation: z.literal("resolveBinaryConflict"),
                repositoryId: RepositoryIdSchema,
                path: GitRelativePathSchema,
                side: z.enum(["ours", "theirs"]),
            })
            .strict(),
        z
            .object({
                operation: z.literal("loadSubmoduleDiff"),
                repositoryId: RepositoryIdSchema,
                before: FileSourceSchema,
                after: FileSourceSchema,
                path: GitRelativePathSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("resolveWorkingTreeFile"),
                repositoryId: RepositoryIdSchema,
                path: GitRelativePathSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("executeSynchronizedBranchOperation"),
                repositoryIds: z
                    .array(RepositoryIdSchema)
                    .min(1)
                    .max(10_000)
                    .readonly(),
                gitOperation: GitSynchronizedBranchOperationSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("applyMultiRootRollback"),
                steps: z
                    .array(GitMultiRootRollbackStepSchema)
                    .min(1)
                    .max(10_000)
                    .readonly(),
            })
            .strict(),
    ])
    .superRefine((request, context) => {
        const repositoryIds =
            request.operation === "executeSynchronizedBranchOperation"
                ? request.repositoryIds
                : request.operation === "applyMultiRootRollback"
                  ? request.steps.map((step) => step.repositoryId)
                  : null;
        if (
            repositoryIds !== null &&
            new Set(repositoryIds).size !== repositoryIds.length
        ) {
            context.addIssue({
                code: "custom",
                message:
                    "Multi-root requests must not contain duplicate repositories",
            });
        }
    })
    .readonly();
export type GitRepositoryServiceRequest = Readonly<
    z.infer<typeof GitRepositoryServiceRequestSchema>
>;

export const GitRepositoryServiceResultSchema = z
    .discriminatedUnion("operation", [
        z
            .object({
                operation: z.literal("compareBranches"),
                value: GitBranchComparisonSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("preCommitCheck"),
                value: GitPreCommitCheckSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("listGitConfig"),
                value: GitConfigEntriesSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("listSubmodules"),
                value: GitSubmoduleInfosSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("listMergedBranches"),
                value: z
                    .array(z.string().min(1).max(4_096))
                    .max(10_000)
                    .readonly(),
            })
            .strict(),
        z
            .object({
                operation: z.literal("loadCommitSignature"),
                value: GitCommitSignatureSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("listRemotes"),
                value: GitRemoteInfosSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("listWorktrees"),
                value: GitWorktreeInfosSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("readIgnoreRules"),
                value: GitIgnoreRulesSchema,
            })
            .strict(),
        z.object({ operation: z.literal("writeIgnoreRules") }).strict(),
        z
            .object({
                operation: z.literal("pushPreview"),
                value: GitPushPreviewSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("historyRewritePreview"),
                value: GitHistoryRewritePreviewSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("exportPatch"),
                value: GitPatchExportResultSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("createPatchText"),
                value: z.string().max(10 * 1024 * 1024),
            })
            .strict(),
        z.object({ operation: z.literal("importPatch") }).strict(),
        z
            .object({
                operation: z.literal("createShelf"),
                value: GitShelfEntrySchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("listShelves"),
                value: GitShelfEntriesSchema,
            })
            .strict(),
        z.object({ operation: z.literal("applyShelf") }).strict(),
        z.object({ operation: z.literal("deleteShelf") }).strict(),
        z
            .object({
                operation: z.literal("listChangelists"),
                value: GitChangelistsSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("saveChangelist"),
                value: GitChangelistSchema,
            })
            .strict(),
        z.object({ operation: z.literal("deleteChangelist") }).strict(),
        z
            .object({
                operation: z.literal("commitChangelist"),
                value: GitChangelistCommitResultSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("listRecoveryEntries"),
                value: GitRecoveryEntriesSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("restoreRecoveryEntry"),
                value: GitRecoveryRestoreResultSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("listLocalHistoryActivities"),
                value: GitLocalHistoryActivitiesPageSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("readLocalHistoryActivity"),
                value: GitLocalHistoryActivityDetailSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("readLocalHistoryDiff"),
                value: z.string().max(16 * 1024 * 1024),
            })
            .strict(),
        z.object({ operation: z.literal("revertLocalHistory") }).strict(),
        z
            .object({
                operation: z.literal("createLocalHistoryPatch"),
                value: z.string().max(16 * 1024 * 1024),
            })
            .strict(),
        z
            .object({
                operation: z.literal("putLocalHistoryLabel"),
                value: GitLocalHistoryActivitySchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("listConflicts"),
                value: GitConflictFilesSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("readConflict"),
                value: GitConflictContentSchema,
            })
            .strict(),
        z.object({ operation: z.literal("writeConflictResult") }).strict(),
        z.object({ operation: z.literal("resolveBinaryConflict") }).strict(),
        z
            .object({
                operation: z.literal("loadSubmoduleDiff"),
                value: GitSubmoduleDiffSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("resolveWorkingTreeFile"),
                value: GitAbsolutePathSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("executeSynchronizedBranchOperation"),
                value: GitMultiRootResultSchema,
            })
            .strict(),
        z
            .object({
                operation: z.literal("applyMultiRootRollback"),
                value: z
                    .array(GitMultiRootOutcomeSchema)
                    .max(10_000)
                    .readonly(),
            })
            .strict(),
    ])
    .readonly();
export type GitRepositoryServiceResult = Readonly<
    z.infer<typeof GitRepositoryServiceResultSchema>
>;

export const GitOutputStreamSchema = z.enum(["stdout", "stderr"]);
export type GitOutputStream = z.infer<typeof GitOutputStreamSchema>;

export const GitStartedEventSchema = z
    .object({
        kind: z.literal("started"),
        requestId: GitRequestIdSchema,
        displayCommand: z.string().min(1).max(2_048),
        startedAtMs: z.number().int().nonnegative(),
    })
    .strict()
    .readonly();

export const GitOutputEventSchema = z
    .object({
        kind: z.literal("output"),
        requestId: GitRequestIdSchema,
        sequence: z.number().int().nonnegative(),
        stream: GitOutputStreamSchema,
        data: z.string(),
    })
    .strict()
    .readonly();

export const GitCompletedEventSchema = z
    .object({
        kind: z.literal("completed"),
        requestId: GitRequestIdSchema,
        exitCode: z.number().int(),
        durationMs: z.number().int().nonnegative(),
    })
    .strict()
    .readonly();

export const GitFailureCodeSchema = z.enum([
    "gitUnavailable",
    "unsupportedGit",
    "notRepository",
    "repositoryNotOpen",
    "invalidInput",
    "commandFailed",
    "outputLimit",
    "spawnFailed",
]);
export type GitFailureCode = z.infer<typeof GitFailureCodeSchema>;

export const GitCreationOperationSchema = z.enum(["initialize", "clone"]);
export type GitCreationOperation = z.infer<typeof GitCreationOperationSchema>;

const GitCreationIdentitySchema = {
    requestId: GitRequestIdSchema,
    operation: GitCreationOperationSchema,
} as const;

export const GitCreationStartedEventSchema = z
    .object({
        kind: z.literal("started"),
        ...GitCreationIdentitySchema,
        displayCommand: z.string().min(1).max(2_048),
        startedAtMs: z.number().int().nonnegative(),
    })
    .readonly();

export const GitCreationOutputEventSchema = z
    .object({
        kind: z.literal("output"),
        ...GitCreationIdentitySchema,
        sequence: z.number().int().nonnegative(),
        stream: GitOutputStreamSchema,
        data: z.string(),
    })
    .readonly();

export const GitCreationProgressEventSchema = z
    .object({
        kind: z.literal("progress"),
        requestId: GitRequestIdSchema,
        operation: z.literal("clone"),
        sequence: z.number().int().nonnegative(),
        phase: z.string().min(1).max(256),
        percent: z.number().int().min(0).max(100),
        current: z.number().int().nonnegative(),
        total: z.number().int().nonnegative(),
    })
    .readonly();

export const GitCreationCompletedEventSchema = z
    .object({
        kind: z.literal("completed"),
        ...GitCreationIdentitySchema,
        repository: RepositoryRecordSchema,
        exitCode: z.number().int(),
        durationMs: z.number().int().nonnegative(),
    })
    .readonly();

export const GitCreationFailedEventSchema = z
    .object({
        kind: z.literal("failed"),
        ...GitCreationIdentitySchema,
        code: GitFailureCodeSchema,
        message: z.string().min(1).max(4_096),
        exitCode: z.number().int().nullable(),
        durationMs: z.number().int().nonnegative(),
    })
    .readonly();

export const GitCreationCancelledEventSchema = z
    .object({
        kind: z.literal("cancelled"),
        ...GitCreationIdentitySchema,
        reason: z.enum(["requested", "timeout"]),
        durationMs: z.number().int().nonnegative(),
    })
    .readonly();

export const GitCreationEventSchema = z
    .discriminatedUnion("kind", [
        GitCreationStartedEventSchema,
        GitCreationOutputEventSchema,
        GitCreationProgressEventSchema,
        GitCreationCompletedEventSchema,
        GitCreationFailedEventSchema,
        GitCreationCancelledEventSchema,
    ])
    .readonly();
export type GitCreationEvent = Readonly<z.infer<typeof GitCreationEventSchema>>;
export type GitCreationTerminalEvent = Extract<
    GitCreationEvent,
    Readonly<{ kind: "completed" | "failed" | "cancelled" }>
>;
export type GitCreationEventListener = (event: GitCreationEvent) => void;

export const GitFailedEventSchema = z
    .object({
        kind: z.literal("failed"),
        requestId: GitRequestIdSchema,
        code: GitFailureCodeSchema,
        message: z.string().min(1).max(4_096),
        exitCode: z.number().int().nullable(),
        durationMs: z.number().int().nonnegative(),
    })
    .strict()
    .readonly();

export const GitCancelledEventSchema = z
    .object({
        kind: z.literal("cancelled"),
        requestId: GitRequestIdSchema,
        reason: z.enum(["requested", "repositoryClosed", "timeout"]),
        durationMs: z.number().int().nonnegative(),
    })
    .strict()
    .readonly();

export const GitRequestEventSchema = z
    .discriminatedUnion("kind", [
        GitStartedEventSchema,
        GitOutputEventSchema,
        GitCompletedEventSchema,
        GitFailedEventSchema,
        GitCancelledEventSchema,
    ])
    .readonly();
export type GitRequestEvent = Readonly<z.infer<typeof GitRequestEventSchema>>;
export type GitTerminalEvent = Extract<
    GitRequestEvent,
    Readonly<{ kind: "completed" | "failed" | "cancelled" }>
>;

export type GitEventListener = (event: GitRequestEvent) => void;
