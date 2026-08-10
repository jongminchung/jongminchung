import { z } from "zod";
import { GitRequestIdSchema, RepositoryIdSchema } from "../git-identifiers";

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

export const RepositoryRecordFields = {
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

export const GitObjectIdSchema = z.string().regex(/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/u);

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

export const GitRevisionSchema = z
  .string()
  .min(1)
  .max(512)
  .refine(isSafeGitRevision, "Revision contains an unsafe character");
export const GitPathSchema = z.string().min(1).max(16_384);
export const GitBoundedTextSchema = z.string().max(1024 * 1024);
export const GitUuidSchema = z.uuid();
export const GitChecksumSchema = z.string().regex(/^[0-9a-f]{64}$/u);
export const GitOptionalChecksumSchema = z.string().regex(/^(?:|[0-9a-f]{64})$/u);
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
export const GitAbsolutePathSchema = GitPathSchema.refine(
  hasAbsolutePathStructure,
  "Selected path must be absolute",
);
export const GitServiceMessageSchema = z
  .string()
  .min(1)
  .max(1024 * 1024)
  .refine((value) => !value.includes("\0"), "Message must not contain NUL")
  .refine((value) => isWithinUtf8Bytes(value, 1024 * 1024), "Message must not exceed 1 MiB");
export const GitConflictResultSchema = z
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
