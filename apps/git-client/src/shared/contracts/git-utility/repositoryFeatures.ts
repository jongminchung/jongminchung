import { z } from "zod";
import { RepositoryIdSchema } from "../git-identifiers";
import { GitOperationSchema, type ValidatedGitOperation } from "../git-operation";
import {
  GitAbsolutePathSchema,
  GitBoundedTextSchema,
  GitChecksumSchema,
  GitObjectIdSchema,
  GitOptionalChecksumSchema,
  GitPathSchema,
  GitRelativePathSchema,
  GitRevisionSchema,
  GitServiceMessageSchema,
  GitUuidSchema,
} from "./repositoryCommon";

type GitSynchronizedBranchOperation =
  | Extract<ValidatedGitOperation, { readonly kind: "checkout" }>
  | Extract<ValidatedGitOperation, { readonly kind: "createBranch" }>;
type GitMultiRootRollbackOperation =
  | Extract<ValidatedGitOperation, { readonly kind: "checkout" }>
  | Extract<ValidatedGitOperation, { readonly kind: "deleteBranch" }>;

export const GitSynchronizedBranchOperationSchema = GitOperationSchema.transform(
  (operation, context): GitSynchronizedBranchOperation => {
    if (operation.kind === "checkout" && !operation.force) return operation;
    if (operation.kind === "createBranch" && operation.checkout) return operation;
    context.addIssue({
      code: "custom",
      message:
        "Only non-forced checkout and create-and-checkout branch operations can be synchronized",
    });
    return z.NEVER;
  },
);
const GitMultiRootRollbackOperationSchema = GitOperationSchema.transform(
  (operation, context): GitMultiRootRollbackOperation => {
    if (operation.kind === "checkout" && !operation.force) return operation;
    if (operation.kind === "deleteBranch" && !operation.force) return operation;
    context.addIssue({
      code: "custom",
      message: "Rollback operations must be non-forced checkout or delete-branch operations",
    });
    return z.NEVER;
  },
);
export const GitMultiRootOutcomeSchema = z
  .object({
    repositoryId: RepositoryIdSchema,
    path: GitAbsolutePathSchema,
    succeeded: z.boolean(),
    message: z
      .string()
      .min(1)
      .max(4_096)
      .refine((value) => !value.includes("\0"), "Outcome message must not contain NUL"),
  })
  .strict()
  .readonly();
export type GitMultiRootOutcome = Readonly<z.infer<typeof GitMultiRootOutcomeSchema>>;
export const GitMultiRootRollbackStepSchema = z
  .object({
    repositoryId: RepositoryIdSchema,
    path: GitAbsolutePathSchema,
    description: z
      .string()
      .min(1)
      .max(4_096)
      .refine((value) => !value.includes("\0"), "Rollback description must not contain NUL"),
    operations: z.array(GitMultiRootRollbackOperationSchema).min(1).max(2).readonly(),
  })
  .strict()
  .readonly();
export type GitMultiRootRollbackStep = Readonly<z.infer<typeof GitMultiRootRollbackStepSchema>>;
export const GitMultiRootResultSchema = z
  .object({
    outcomes: z.array(GitMultiRootOutcomeSchema).max(10_000).readonly(),
    rollbackPlan: z.array(GitMultiRootRollbackStepSchema).max(10_000).readonly(),
  })
  .strict()
  .readonly();
export type GitMultiRootResult = Readonly<z.infer<typeof GitMultiRootResultSchema>>;

export const GitPatchExportResultSchema = z
  .object({
    path: GitAbsolutePathSchema,
    sizeBytes: z
      .number()
      .int()
      .nonnegative()
      .max(20 * 1024 * 1024),
    commitCount: z.number().int().min(1).max(500),
  })
  .strict()
  .readonly();
export type GitPatchExportResult = Readonly<z.infer<typeof GitPatchExportResultSchema>>;

export const GitShelfFileSchema = z
  .object({
    path: GitRelativePathSchema,
    checksum: GitOptionalChecksumSchema,
    untracked: z.boolean(),
  })
  .strict()
  .readonly();
export const GitShelfEntrySchema = z
  .object({
    id: GitUuidSchema,
    repositoryId: RepositoryIdSchema,
    message: z.string().max(1024 * 1024),
    createdAtMs: z.number().int().nonnegative().safe(),
    files: z.array(GitShelfFileSchema).max(10_000).readonly(),
    indexPatchChecksum: GitChecksumSchema,
    worktreePatchChecksum: GitChecksumSchema,
  })
  .strict()
  .readonly();
export type GitShelfEntry = Readonly<z.infer<typeof GitShelfEntrySchema>>;
export const GitShelfEntriesSchema = z.array(GitShelfEntrySchema).max(10_000).readonly();

export const GitChangelistSchema = z
  .object({
    id: GitUuidSchema,
    repositoryId: RepositoryIdSchema,
    name: GitServiceMessageSchema,
    paths: z.array(GitRelativePathSchema).max(10_000).readonly(),
    createdAtMs: z.number().int().nonnegative().safe(),
    updatedAtMs: z.number().int().nonnegative().safe(),
  })
  .strict()
  .readonly();
export type GitChangelist = Readonly<z.infer<typeof GitChangelistSchema>>;
export const GitChangelistsSchema = z.array(GitChangelistSchema).max(10_000).readonly();
export const GitChangelistCommitResultSchema = z
  .object({
    changelistId: GitUuidSchema,
    commitOid: GitObjectIdSchema,
  })
  .strict()
  .readonly();
export type GitChangelistCommitResult = Readonly<z.infer<typeof GitChangelistCommitResultSchema>>;

export const GitRecoveryRefSchema = z
  .object({
    name: z.string().min(1).max(16_384),
    oid: GitObjectIdSchema.nullable(),
  })
  .strict()
  .readonly();
export const GitRecoveryEntrySchema = z
  .object({
    id: GitUuidSchema,
    repositoryId: RepositoryIdSchema,
    operation: z.string().min(1).max(16_384),
    createdAtMs: z.number().int().nonnegative().safe(),
    branch: z.string().min(1).max(16_384).nullable(),
    headOid: GitObjectIdSchema.nullable(),
    refs: z.array(GitRecoveryRefSchema).max(32).readonly(),
    recoverable: z.boolean(),
  })
  .strict()
  .readonly();
export type GitRecoveryEntry = Readonly<z.infer<typeof GitRecoveryEntrySchema>>;
export const GitRecoveryEntriesSchema = z.array(GitRecoveryEntrySchema).max(200).readonly();
export const GitRecoveryRestoreResultSchema = z
  .object({
    entryId: GitUuidSchema,
    restoredRefs: z.array(z.string().min(1).max(16_384)).max(32).readonly(),
  })
  .strict()
  .readonly();
export type GitRecoveryRestoreResult = Readonly<z.infer<typeof GitRecoveryRestoreResultSchema>>;

export const GitLocalHistoryScopeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("project"), repositoryId: RepositoryIdSchema }).strict(),
  z
    .object({
      kind: z.literal("file"),
      repositoryId: RepositoryIdSchema,
      path: GitRelativePathSchema,
    })
    .strict(),
  z.object({ kind: z.literal("recent"), repositoryId: RepositoryIdSchema }).strict(),
]);
export type GitLocalHistoryScope = Readonly<z.infer<typeof GitLocalHistoryScopeSchema>>;

export const GitLocalHistoryContentAvailabilitySchema = z.enum([
  "available",
  "unavailable",
  "notApplicable",
]);
export type GitLocalHistoryContentAvailability = z.infer<
  typeof GitLocalHistoryContentAvailabilitySchema
>;

const GitLocalHistoryChangeBaseSchema = z.object({
  path: GitRelativePathSchema,
  contentAvailability: GitLocalHistoryContentAvailabilitySchema,
});
export const GitLocalHistoryChangeSchema = z.discriminatedUnion("kind", [
  GitLocalHistoryChangeBaseSchema.extend({ kind: z.literal("content") }).strict(),
  GitLocalHistoryChangeBaseSchema.extend({ kind: z.literal("create") }).strict(),
  GitLocalHistoryChangeBaseSchema.extend({ kind: z.literal("delete") }).strict(),
  GitLocalHistoryChangeBaseSchema.extend({
    kind: z.literal("move"),
    previousPath: GitRelativePathSchema,
  }).strict(),
  GitLocalHistoryChangeBaseSchema.extend({
    kind: z.literal("rename"),
    previousPath: GitRelativePathSchema,
  }).strict(),
  GitLocalHistoryChangeBaseSchema.extend({
    kind: z.literal("readOnly"),
    readOnly: z.boolean(),
  }).strict(),
]);
export type GitLocalHistoryChange = Readonly<z.infer<typeof GitLocalHistoryChangeSchema>>;

export const GitLocalHistoryActivitySchema = z
  .object({
    id: GitUuidSchema,
    repositoryId: RepositoryIdSchema,
    createdAtMs: z.number().int().nonnegative().safe(),
    name: z.string().min(1).max(16_384),
    label: z.string().min(1).max(16_384).nullable(),
    system: z.boolean(),
    paths: z.array(GitRelativePathSchema).max(20_000).readonly(),
    changeCount: z.number().int().nonnegative().max(20_000),
  })
  .strict()
  .readonly();
export type GitLocalHistoryActivity = Readonly<z.infer<typeof GitLocalHistoryActivitySchema>>;
export const GitLocalHistoryActivitiesPageSchema = z
  .object({
    activities: z.array(GitLocalHistoryActivitySchema).max(500).readonly(),
    nextCursor: z.string().min(1).max(256).nullable(),
  })
  .strict()
  .readonly();
export type GitLocalHistoryActivitiesPage = Readonly<
  z.infer<typeof GitLocalHistoryActivitiesPageSchema>
>;
export const GitLocalHistoryActivityDetailSchema = z
  .object({
    activity: GitLocalHistoryActivitySchema,
    changes: z.array(GitLocalHistoryChangeSchema).max(20_000).readonly(),
  })
  .strict()
  .readonly();
export type GitLocalHistoryActivityDetail = Readonly<
  z.infer<typeof GitLocalHistoryActivityDetailSchema>
>;

export const GitConflictFileSchema = z
  .object({
    path: GitRelativePathSchema,
    baseOid: GitObjectIdSchema.nullable(),
    localOid: GitObjectIdSchema.nullable(),
    remoteOid: GitObjectIdSchema.nullable(),
    binary: z.boolean(),
  })
  .strict()
  .readonly();
export type GitConflictFile = Readonly<z.infer<typeof GitConflictFileSchema>>;
export const GitConflictFilesSchema = z.array(GitConflictFileSchema).max(50_000).readonly();
const GitConflictSideContentSchema = z
  .string()
  .max(5 * 1024 * 1024)
  .nullable();
export const GitConflictContentSchema = z
  .object({
    path: GitRelativePathSchema,
    base: GitConflictSideContentSchema,
    local: GitConflictSideContentSchema,
    remote: GitConflictSideContentSchema,
    result: GitConflictSideContentSchema,
    binary: z.boolean(),
    localLabel: z.string().max(16_384),
    remoteLabel: z.string().max(16_384),
  })
  .strict()
  .readonly();
export type GitConflictContent = Readonly<z.infer<typeof GitConflictContentSchema>>;

export const GitBranchComparisonSchema = z
  .object({
    ahead: z.number().int().nonnegative().safe(),
    behind: z.number().int().nonnegative().safe(),
    leftOnly: z.array(GitObjectIdSchema).max(500),
    rightOnly: z.array(GitObjectIdSchema).max(500),
  })
  .strict()
  .readonly();
export type GitBranchComparison = Readonly<z.infer<typeof GitBranchComparisonSchema>>;

export const GitPreCommitCheckSchema = z
  .object({
    branch: z.string().min(1).max(4_096).nullable(),
    detachedHead: z.boolean(),
    protectedBranch: z.boolean(),
    crlfPaths: z.array(GitPathSchema).max(50_000),
    largeFiles: z.array(GitPathSchema).max(50_000),
    riskyPaths: z.array(GitPathSchema).max(50_000),
    hooks: z.array(z.string().min(1).max(256)).max(64),
  })
  .strict()
  .readonly();
export type GitPreCommitCheck = Readonly<z.infer<typeof GitPreCommitCheckSchema>>;

export const GitConfigEntrySchema = z
  .object({
    key: z.string().min(1).max(4_096),
    value: GitBoundedTextSchema,
    origin: z.string().min(1).max(16_384),
    scope: z.string().min(1).max(128).nullable(),
  })
  .strict()
  .readonly();
export type GitConfigEntry = Readonly<z.infer<typeof GitConfigEntrySchema>>;
export const GitConfigEntriesSchema = z.array(GitConfigEntrySchema).max(10_000).readonly();

export const GitSubmoduleInfoSchema = z
  .object({
    path: GitPathSchema,
    oid: GitObjectIdSchema.nullable(),
    branch: z.string().min(1).max(4_096).nullable(),
    status: z.enum(["clean", "uninitialized", "modified", "conflicted"]),
    initialized: z.boolean(),
  })
  .strict()
  .readonly();
export type GitSubmoduleInfo = Readonly<z.infer<typeof GitSubmoduleInfoSchema>>;
export const GitSubmoduleInfosSchema = z.array(GitSubmoduleInfoSchema).max(10_000).readonly();

export const GitCommitSignatureSchema = z
  .object({
    status: z.string().length(1),
    fingerprint: z.string().min(1).max(4_096).nullable(),
    signer: z.string().min(1).max(4_096).nullable(),
    keyId: z.string().min(1).max(4_096).nullable(),
    trust: z.string().min(1).max(4_096).nullable(),
  })
  .strict()
  .readonly();
export type GitCommitSignature = Readonly<z.infer<typeof GitCommitSignatureSchema>>;

export const GitRemoteInfoSchema = z
  .object({
    name: z.string().min(1).max(4_096),
    fetchUrl: z.string().min(1).max(16_384),
    pushUrl: z.string().min(1).max(16_384),
  })
  .strict()
  .readonly();
export type GitRemoteInfo = Readonly<z.infer<typeof GitRemoteInfoSchema>>;
export const GitRemoteInfosSchema = z.array(GitRemoteInfoSchema).max(1_000).readonly();

export const GitWorktreeInfoSchema = z
  .object({
    path: GitPathSchema,
    headOid: GitObjectIdSchema.nullable(),
    branch: z.string().min(1).max(4_096).nullable(),
    bare: z.boolean(),
    detached: z.boolean(),
    locked: z.boolean(),
    prunable: z.boolean(),
    isMain: z.boolean(),
  })
  .strict()
  .readonly();
export type GitWorktreeInfo = Readonly<z.infer<typeof GitWorktreeInfoSchema>>;
export const GitWorktreeInfosSchema = z.array(GitWorktreeInfoSchema).max(1_000).readonly();

const IgnoreRuleTextSchema = GitBoundedTextSchema.refine(
  (value) => !value.includes("\0"),
  "Ignore rules must not contain null bytes",
);
export const GitIgnoreRulesSchema = z
  .object({
    gitignore: IgnoreRuleTextSchema,
    infoExclude: IgnoreRuleTextSchema,
  })
  .strict()
  .readonly();
export type GitIgnoreRules = Readonly<z.infer<typeof GitIgnoreRulesSchema>>;

const GitPreviewSubjectSchema = z
  .string()
  .max(4_096)
  .refine((value) => !value.includes("\0"), "Subject must not contain a null byte");
const GitPreviewWarningSchema = z.string().min(1).max(8_192);
const GitPushPreviewCommitSchema = z
  .object({ oid: GitObjectIdSchema, subject: GitPreviewSubjectSchema })
  .strict();
export const GitPushPreviewSchema = z
  .object({
    sourceBranch: z.string().min(1).max(4_096).nullable(),
    sourceRevision: GitRevisionSchema,
    localOid: GitObjectIdSchema,
    remote: z.string().min(1).max(512),
    remoteRef: z.string().min(1).max(512),
    upstreamConfigured: z.boolean(),
    setUpstreamDefault: z.boolean(),
    remoteOid: GitObjectIdSchema.nullable(),
    expectedLeaseOid: GitObjectIdSchema.nullable(),
    ahead: z.number().int().nonnegative().safe(),
    behind: z.number().int().nonnegative().safe(),
    fastForward: z.boolean().nullable(),
    newBranch: z.boolean(),
    commits: z.array(GitPushPreviewCommitSchema).max(200),
    remoteOnlyCommits: z.array(GitPushPreviewCommitSchema).max(200),
    protectedBranch: z.boolean(),
    checkedAtMs: z.number().int().nonnegative().safe(),
    remoteStateError: z.string().min(1).max(8_192).nullable(),
    warnings: z.array(GitPreviewWarningSchema).max(100),
  })
  .strict()
  .readonly();
export type GitPushPreview = Readonly<z.infer<typeof GitPushPreviewSchema>>;

const GitPreviewRebaseEntrySchema = z
  .object({
    oid: GitObjectIdSchema,
    subject: GitPreviewSubjectSchema,
    parents: z.array(GitObjectIdSchema).max(64),
    action: z.enum(["pick", "reword", "edit", "squash", "fixup", "drop"]),
    message: GitBoundedTextSchema.nullable(),
    published: z.boolean(),
    mergeCommit: z.boolean(),
  })
  .strict();
const GitDependentRefImpactSchema = z
  .object({ name: z.string().min(1).max(4_096), oid: GitObjectIdSchema })
  .strict();
export const GitHistoryRewritePreviewSchema = z
  .object({
    branch: z.string().min(1).max(4_096),
    headOid: GitObjectIdSchema,
    base: GitObjectIdSchema.nullable(),
    root: z.boolean(),
    entries: z.array(GitPreviewRebaseEntrySchema).min(1).max(500),
    publishedCommitCount: z.number().int().nonnegative().max(500),
    descendantCount: z.number().int().nonnegative().max(500),
    dependentRefs: z.array(GitDependentRefImpactSchema).max(10_000),
    hasMerges: z.boolean(),
    protectedBranch: z.boolean(),
    warnings: z.array(GitPreviewWarningSchema).max(100),
  })
  .strict()
  .readonly();
export type GitHistoryRewritePreview = Readonly<z.infer<typeof GitHistoryRewritePreviewSchema>>;
