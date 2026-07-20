import { z } from "zod";
import { GitRequestIdSchema, RepositoryIdSchema } from "./git-identifiers";
import { GitOperationSchema, type ValidatedGitOperation } from "./git-operation";

export {
  GitRequestIdSchema,
  RepositoryIdSchema,
  type GitRequestId,
  type RepositoryId,
} from "./git-identifiers";
export {
  GitExecutionRequestSchema,
  GitQueryRequestSchema,
  type GitExecutionRequest,
  type GitQueryRequest,
} from "./git-request";

export const MINIMUM_GIT_VERSION = Object.freeze({ major: 2, minor: 39 });
export const GIT_QUERY_TIMEOUT_MS = 120_000;
export const GIT_OUTPUT_LIMIT_BYTES = 16 * 1024 * 1024;
export const GIT_EVENT_CHUNK_CHARACTERS = 32 * 1024;

export const GitVersionSchema = z
  .object({
    major: z.number().int().nonnegative(),
    minor: z.number().int().nonnegative(),
    patch: z.number().int().nonnegative(),
    display: z.string().min(1).max(256),
  })
  .readonly();
export type GitVersion = Readonly<z.infer<typeof GitVersionSchema>>;

export const OpenRepositoryRequestSchema = z
  .object({
    path: z.string().min(1).max(16_384),
  })
  .readonly();
export type OpenRepositoryRequest = Readonly<z.infer<typeof OpenRepositoryRequestSchema>>;

export const GitInitializeRepositoryRequestSchema = z
  .object({
    requestId: GitRequestIdSchema,
    path: z.string().min(1).max(16_384),
    bare: z.boolean(),
  })
  .strict()
  .readonly();
export type GitInitializeRepositoryRequest = Readonly<
  z.infer<typeof GitInitializeRepositoryRequestSchema>
>;

export const GitCloneOptionsSchema = z
  .object({
    depth: z.number().int().min(1).max(65_535).nullable(),
    branch: z.string().min(1).max(512).nullable(),
    recurseSubmodules: z.boolean(),
  })
  .strict()
  .readonly();
export type GitCloneOptions = Readonly<z.infer<typeof GitCloneOptionsSchema>>;

export const GitCloneRepositoryRequestSchema = z
  .object({
    requestId: GitRequestIdSchema,
    url: z.string().min(1).max(16_384),
    path: z.string().min(1).max(16_384),
    options: GitCloneOptionsSchema,
  })
  .strict()
  .readonly();
export type GitCloneRepositoryRequest = Readonly<z.infer<typeof GitCloneRepositoryRequestSchema>>;

const RepositoryRecordFields = {
  id: RepositoryIdSchema,
  name: z.string().min(1).max(4_096),
  path: z.string().min(1).max(16_384),
  gitDirectory: z.string().min(1).max(16_384),
  commonDirectory: z.string().min(1).max(16_384),
  isBare: z.boolean(),
  gitVersion: GitVersionSchema,
} as const;

export const RepositoryRecordSchema = z.object(RepositoryRecordFields).strict().readonly();
export type RepositoryRecord = Readonly<z.infer<typeof RepositoryRecordSchema>>;

export const InProgressOperationSchema = z.enum([
  "merge",
  "rebase",
  "cherryPick",
  "revert",
  "bisect",
]);

const GitObjectIdSchema = z.string().regex(/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/u);

export const RepositorySnapshotSchema = z
  .object({
    ...RepositoryRecordFields,
    currentBranch: z.string().min(1).max(4_096).nullable(),
    headOid: GitObjectIdSchema.nullable(),
    upstream: z.string().min(1).max(4_096).nullable(),
    remoteUrl: z.string().min(1).max(16_384).nullable(),
    ahead: z.number().int().nonnegative().safe(),
    behind: z.number().int().nonnegative().safe(),
    isShallow: z.boolean(),
    isDetached: z.boolean(),
    hasCommits: z.boolean(),
    operation: InProgressOperationSchema.nullable(),
  })
  .strict()
  .readonly();
export type RepositorySnapshot = Readonly<z.infer<typeof RepositorySnapshotSchema>>;

function isSafeGitRevision(value: string): boolean {
  if (value.startsWith("-")) return false;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x20 || codePoint === 0x7f) return false;
  }
  return true;
}

const GitRevisionSchema = z
  .string()
  .min(1)
  .max(512)
  .refine(isSafeGitRevision, "Revision contains an unsafe character");
const GitPathSchema = z.string().min(1).max(16_384);
const GitBoundedTextSchema = z.string().max(1024 * 1024);
const GitUuidSchema = z.uuid();
const GitChecksumSchema = z.string().regex(/^[0-9a-f]{64}$/u);
const GitOptionalChecksumSchema = z.string().regex(/^(?:|[0-9a-f]{64})$/u);
const GitServiceTextEncoder = new TextEncoder();

function hasSafeRelativePath(value: string): boolean {
  return !(
    value.includes("\0") ||
    value.startsWith("/") ||
    value.startsWith("\\") ||
    /^[A-Za-z]:[\\/]/u.test(value) ||
    value.split(/[\\/]/u).includes("..")
  );
}

function hasAbsolutePathStructure(value: string): boolean {
  if (value.includes("\0")) return false;
  return (
    value.startsWith("/") ||
    /^[A-Za-z]:[\\/]/u.test(value) ||
    /^\\\\[^\\/]+[\\/][^\\/]+/u.test(value)
  );
}

function isWithinUtf8Bytes(value: string, maximum: number): boolean {
  return GitServiceTextEncoder.encode(value).byteLength <= maximum;
}

export const GitRelativePathSchema = GitPathSchema.refine(
  hasSafeRelativePath,
  "Path must stay inside the repository",
);
const GitAbsolutePathSchema = GitPathSchema.refine(
  hasAbsolutePathStructure,
  "Selected path must be absolute",
);
const GitServiceMessageSchema = z
  .string()
  .min(1)
  .max(1024 * 1024)
  .refine((value) => !value.includes("\0"), "Message must not contain NUL")
  .refine((value) => isWithinUtf8Bytes(value, 1024 * 1024), "Message must not exceed 1 MiB");
const GitConflictResultSchema = z
  .string()
  .max(5 * 1024 * 1024)
  .refine((value) => !value.includes("\0"), "Conflict result must not contain NUL")
  .refine(
    (value) => isWithinUtf8Bytes(value, 5 * 1024 * 1024),
    "Conflict result must not exceed 5 MiB",
  );

export const FileSourceSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("workingTree") }).strict(),
    z.object({ kind: z.literal("index") }).strict(),
    z
      .object({
        kind: z.literal("revision"),
        revision: GitRevisionSchema,
      })
      .strict(),
  ])
  .readonly();
export type FileSource = Readonly<z.infer<typeof FileSourceSchema>>;

export const GitSubmoduleDiffSchema = z
  .object({
    path: GitRelativePathSchema,
    beforeOid: GitObjectIdSchema.nullable(),
    afterOid: GitObjectIdSchema.nullable(),
    beforeSubject: z.string().max(4_096).nullable(),
    afterSubject: z.string().max(4_096).nullable(),
    ahead: z.number().int().nonnegative().safe().nullable(),
    behind: z.number().int().nonnegative().safe().nullable(),
  })
  .strict()
  .readonly();
export type GitSubmoduleDiff = Readonly<z.infer<typeof GitSubmoduleDiffSchema>>;

export const GitWorkingTreeFileRequestSchema = z
  .object({
    repositoryId: RepositoryIdSchema,
    path: GitRelativePathSchema,
  })
  .strict()
  .readonly();
export type GitWorkingTreeFileRequest = Readonly<z.infer<typeof GitWorkingTreeFileRequestSchema>>;

export const GitWriteWorkingTreeFileRequestSchema = z
  .object({
    repositoryId: RepositoryIdSchema,
    path: GitRelativePathSchema,
    content: z
      .string()
      .max(5 * 1024 * 1024)
      .refine(
        (value) => isWithinUtf8Bytes(value, 5 * 1024 * 1024),
        "File content must not exceed 5 MiB",
      ),
    activityName: z.string().min(1).max(16_384).nullable(),
  })
  .strict()
  .readonly();
export type GitWriteWorkingTreeFileRequest = Readonly<
  z.infer<typeof GitWriteWorkingTreeFileRequestSchema>
>;

type GitSynchronizedBranchOperation =
  | Extract<ValidatedGitOperation, { readonly kind: "checkout" }>
  | Extract<ValidatedGitOperation, { readonly kind: "createBranch" }>;
type GitMultiRootRollbackOperation =
  | Extract<ValidatedGitOperation, { readonly kind: "checkout" }>
  | Extract<ValidatedGitOperation, { readonly kind: "deleteBranch" }>;

const GitSynchronizedBranchOperationSchema = GitOperationSchema.transform(
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
        revisions: z.array(GitRevisionSchema).min(1).max(500).readonly(),
        targetPath: GitAbsolutePathSchema,
      })
      .strict(),
    z
      .object({
        operation: z.literal("createPatchText"),
        repositoryId: RepositoryIdSchema,
        revisions: z.array(GitRevisionSchema).min(1).max(500).readonly(),
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
        paths: z.array(GitRelativePathSchema).min(1).max(10_000).readonly(),
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
        paths: z.array(GitRelativePathSchema).min(1).max(20_000).readonly(),
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
        repositoryIds: z.array(RepositoryIdSchema).min(1).max(10_000).readonly(),
        gitOperation: GitSynchronizedBranchOperationSchema,
      })
      .strict(),
    z
      .object({
        operation: z.literal("applyMultiRootRollback"),
        steps: z.array(GitMultiRootRollbackStepSchema).min(1).max(10_000).readonly(),
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
    if (repositoryIds !== null && new Set(repositoryIds).size !== repositoryIds.length) {
      context.addIssue({
        code: "custom",
        message: "Multi-root requests must not contain duplicate repositories",
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
        value: z.array(z.string().min(1).max(4_096)).max(10_000).readonly(),
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
        value: z.array(GitMultiRootOutcomeSchema).max(10_000).readonly(),
      })
      .strict(),
  ])
  .readonly();
export type GitRepositoryServiceResult = Readonly<z.infer<typeof GitRepositoryServiceResultSchema>>;

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

const FilePathSchema = z.string().min(1).max(16_384);
const FileSizeSchema = z.number().int().nonnegative().safe();

export const GitReadFileRequestSchema = z
  .object({
    repositoryId: RepositoryIdSchema,
    source: FileSourceSchema,
    path: FilePathSchema,
  })
  .strict()
  .readonly();
export type GitReadFileRequest = Readonly<z.infer<typeof GitReadFileRequestSchema>>;

export const FileContentSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("text"),
        path: FilePathSchema,
        content: z.string().max(5 * 1024 * 1024),
        sizeBytes: FileSizeSchema,
        lineCount: z.number().int().nonnegative().max(50_000),
      })
      .strict(),
    z
      .object({
        kind: z.literal("binary"),
        path: FilePathSchema,
        sizeBytes: FileSizeSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("invalidUtf8"),
        path: FilePathSchema,
        sizeBytes: FileSizeSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("tooLarge"),
        path: FilePathSchema,
        sizeBytes: FileSizeSchema,
        lineCount: z.number().int().nonnegative().nullable(),
      })
      .strict(),
    z.object({ kind: z.literal("missing"), path: FilePathSchema }).strict(),
  ])
  .readonly();
export type FileContent = Readonly<z.infer<typeof FileContentSchema>>;

export const FilePreviewSchema = z
  .discriminatedUnion("kind", [
    z
      .object({
        kind: z.literal("image"),
        preview: z
          .object({
            path: FilePathSchema,
            mimeType: z.enum(["image/png", "image/jpeg", "image/webp"]),
            dataUrl: z.string().max(8 * 1024 * 1024),
            sizeBytes: FileSizeSchema,
          })
          .strict()
          .readonly(),
      })
      .strict(),
    z
      .object({
        kind: z.literal("binary"),
        path: FilePathSchema,
        sizeBytes: FileSizeSchema,
      })
      .strict(),
    z
      .object({
        kind: z.literal("tooLarge"),
        path: FilePathSchema,
        sizeBytes: FileSizeSchema,
      })
      .strict(),
    z.object({ kind: z.literal("missing"), path: FilePathSchema }).strict(),
  ])
  .readonly();
export type FilePreview = Readonly<z.infer<typeof FilePreviewSchema>>;

export const RepositoryInvalidationSchema = z.enum([
  "status",
  "history",
  "stash",
  "operation",
  "management",
]);

export const RepositoryChangedEventSchema = z
  .object({
    repositoryId: RepositoryIdSchema,
    invalidations: z.array(RepositoryInvalidationSchema).min(1).max(5),
  })
  .strict()
  .superRefine((event, context) => {
    if (new Set(event.invalidations).size !== event.invalidations.length) {
      context.addIssue({
        code: "custom",
        path: ["invalidations"],
        message: "Repository invalidations must be unique",
      });
    }
  })
  .readonly();
export type RepositoryChangedEvent = Readonly<z.infer<typeof RepositoryChangedEventSchema>>;
export type RepositoryChangedListener = (event: RepositoryChangedEvent) => void;

export const GitWatchRepositoryRequestSchema = z
  .object({ repositoryId: RepositoryIdSchema })
  .strict()
  .readonly();
export type GitWatchRepositoryRequest = Readonly<z.infer<typeof GitWatchRepositoryRequestSchema>>;
