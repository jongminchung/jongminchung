import { z } from "zod";

export const MAX_GIT_OPERATION_PATCH_BYTES = 5 * 1024 * 1024;

const MAX_PATH_CHARACTERS = 16_384;
const MAX_TEXT_BYTES = 5 * 1024 * 1024;
const MAX_TEXT_CHARACTERS = 5 * 1024 * 1024;
const MAX_NAME_CHARACTERS = 512;
const MAX_URL_CHARACTERS = 16_384;
const MAX_PATHS = 10_000;
const MAX_REVISIONS = 500;
const MAX_REBASE_ENTRIES = 500;
const MAX_REBASE_PARENTS = 500;
const textEncoder = new TextEncoder();

function hasSafeRevisionStructure(value: string): boolean {
  if (value.startsWith("-")) return false;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x20 || codePoint === 0x7f) return false;
  }
  return true;
}

function hasInvalidRefCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x20 || codePoint === 0x7f || "~^:?*[\\".includes(character)) {
      return true;
    }
  }
  return false;
}

function hasSafeRefStructure(value: string): boolean {
  return !(
    /^[-./]/u.test(value) ||
    /[./]$/u.test(value) ||
    value.endsWith(".lock") ||
    value.includes("..") ||
    value.includes("@{") ||
    value.includes("//") ||
    hasInvalidRefCharacter(value)
  );
}

function isRelativeRepositoryPath(value: string): boolean {
  return !(
    value.includes("\0") ||
    value.startsWith("/") ||
    value.startsWith("\\") ||
    /^[A-Za-z]:[\\/]/u.test(value) ||
    value.split(/[\\/]/u).includes("..")
  );
}

function isAbsoluteWorktreePath(value: string): boolean {
  if (value.includes("\0")) return false;
  return (
    value.startsWith("/") ||
    /^[A-Za-z]:[\\/]/u.test(value) ||
    /^\\\\[^\\/]+[\\/][^\\/]+/u.test(value)
  );
}

function isWithinUtf8Bytes(value: string, maximum: number): boolean {
  return textEncoder.encode(value).byteLength <= maximum;
}

const RelativePathSchema = z
  .string()
  .min(1)
  .max(MAX_PATH_CHARACTERS)
  .refine(isRelativeRepositoryPath, "Path must stay inside the repository");
const AbsoluteWorktreePathSchema = z
  .string()
  .min(1)
  .max(MAX_PATH_CHARACTERS)
  .refine(isAbsoluteWorktreePath, "Worktree path must be absolute");
const RevisionSchema = z
  .string()
  .min(1)
  .max(MAX_NAME_CHARACTERS)
  .refine(
    hasSafeRevisionStructure,
    "Revision must be a non-option value without unsafe characters",
  );
const ObjectOidSchema = z
  .string()
  .regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/iu, "Object ID must contain 40 or 64 hex digits");
const RefNameSchema = z
  .string()
  .min(1)
  .max(MAX_NAME_CHARACTERS)
  .refine(hasSafeRefStructure, "Value must have a safe Git ref structure");
const RefComponentSchema = RefNameSchema.refine(
  (value) => !value.includes("/"),
  "Value must be one Git ref component",
);
const RemoteBranchRefSchema = RefNameSchema.refine(
  (value) => value.startsWith("refs/heads/"),
  "Remote branch must use the full refs/heads name",
);
const BoundedTextSchema = z
  .string()
  .max(MAX_TEXT_CHARACTERS)
  .refine((value) => !value.includes("\0"), "Text must not contain a null byte")
  .refine((value) => isWithinUtf8Bytes(value, MAX_TEXT_BYTES), "Text must not exceed 5 MiB");
const NonEmptyMessageSchema = BoundedTextSchema.refine(
  (value) => value.trim().length > 0,
  "Message must not be empty",
);
const PatchSchema = z
  .string()
  .max(MAX_GIT_OPERATION_PATCH_BYTES)
  .refine((value) => !value.includes("\0"), "Patch must not contain a null byte")
  .refine(
    (value) => isWithinUtf8Bytes(value, MAX_GIT_OPERATION_PATCH_BYTES),
    "Patch must not exceed 5 MiB",
  );
const UrlSchema = z
  .string()
  .min(1)
  .max(MAX_URL_CHARACTERS)
  .refine((value) => !value.includes("\0") && !value.startsWith("-"), "URL must not be an option");
const ConfigKeySchema = z
  .string()
  .min(1)
  .max(MAX_NAME_CHARACTERS)
  .refine(
    (value) =>
      !value.includes("\0") &&
      !/^[.-]/u.test(value) &&
      !value.endsWith(".") &&
      value.includes(".") &&
      /^[A-Za-z0-9.-]+$/u.test(value),
    "Key must have a safe Git config structure",
  );

const RequiredPathsSchema = z.array(RelativePathSchema).min(1).max(MAX_PATHS);
const RevisionsSchema = z.array(RevisionSchema).min(1).max(MAX_REVISIONS);
const SquashRevisionsSchema = z.array(RevisionSchema).min(2).max(MAX_REVISIONS);

const PushDestinationSchema = z
  .object({
    remote: RefComponentSchema,
    remoteRef: RemoteBranchRefSchema,
    localRevision: RevisionSchema,
    setUpstream: z.boolean(),
  })
  .strict();
const PushModeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("normal") }).strict(),
  z.object({ kind: z.literal("forceWithLease"), expectedRemoteOid: ObjectOidSchema }).strict(),
]);
const HistoryRewriteOptionsSchema = z
  .object({
    autostash: z.boolean(),
    updateRefs: z.boolean(),
    preserveMerges: z.boolean(),
  })
  .strict();
const RebasePlanEntrySchema = z
  .object({
    oid: ObjectOidSchema,
    subject: z
      .string()
      .max(MAX_PATH_CHARACTERS)
      .refine((value) => !value.includes("\0"), "Subject must not contain a null byte"),
    parents: z.array(ObjectOidSchema).max(MAX_REBASE_PARENTS),
    action: z.enum(["pick", "reword", "edit", "squash", "fixup", "drop"]),
    message: BoundedTextSchema.nullable(),
    published: z.boolean(),
    mergeCommit: z.boolean(),
  })
  .strict();
const RebasePlanSchema = z
  .array(RebasePlanEntrySchema)
  .min(1)
  .max(MAX_REBASE_ENTRIES)
  .superRefine((entries, context) => {
    const seen = new Set<string>();
    let hasTarget = false;
    for (const [index, entry] of entries.entries()) {
      const normalizedOid = entry.oid.toLowerCase();
      if (seen.has(normalizedOid)) {
        context.addIssue({
          code: "custom",
          message: "Rebase plan must not contain duplicate commits",
          path: [index, "oid"],
        });
      }
      seen.add(normalizedOid);
      if (entry.mergeCommit && entry.action !== "pick") {
        context.addIssue({
          code: "custom",
          message: "Merge commits must remain pick entries",
          path: [index, "action"],
        });
      }
      if (
        entry.action === "reword" &&
        (entry.message === null || entry.message.trim().length === 0)
      ) {
        context.addIssue({
          code: "custom",
          message: "Reword entries require a non-empty message",
          path: [index, "message"],
        });
      }
      if ((entry.action === "squash" || entry.action === "fixup") && !hasTarget) {
        context.addIssue({
          code: "custom",
          message: "Squash and fixup require an earlier picked commit",
          path: [index, "action"],
        });
      }
      if (entry.action !== "drop") hasTarget = true;
    }
    if (!hasTarget) {
      context.addIssue({
        code: "custom",
        message: "Rebase plan cannot drop every commit",
      });
    }
  });

export const GitOperationSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("stage"), paths: RequiredPathsSchema }).strict(),
  z.object({ kind: z.literal("stageAll") }).strict(),
  z.object({ kind: z.literal("stageTracked") }).strict(),
  z.object({ kind: z.literal("addIntent"), paths: RequiredPathsSchema }).strict(),
  z.object({ kind: z.literal("unstage"), paths: RequiredPathsSchema }).strict(),
  z.object({ kind: z.literal("removeCached"), paths: RequiredPathsSchema }).strict(),
  z.object({ kind: z.literal("discard"), paths: RequiredPathsSchema }).strict(),
  z
    .object({
      kind: z.literal("applyPatch"),
      patch: PatchSchema,
      cached: z.boolean(),
      reverse: z.boolean(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("partialPatch"),
      patch: PatchSchema,
      cached: z.boolean(),
      reverse: z.boolean(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("commit"),
      message: NonEmptyMessageSchema,
      amend: z.boolean(),
      signOff: z.boolean(),
      gpgSign: z.boolean(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("commitAdvanced"),
      message: NonEmptyMessageSchema,
      amend: z.boolean(),
      signOff: z.boolean(),
      gpgSign: z.boolean(),
      skipHooks: z.boolean(),
      commitAll: z.boolean(),
    })
    .strict(),
  z
    .object({ kind: z.literal("fetch"), remote: RefComponentSchema.nullable(), prune: z.boolean() })
    .strict(),
  z.object({ kind: z.literal("pull"), rebase: z.boolean() }).strict(),
  z
    .object({ kind: z.literal("push"), destination: PushDestinationSchema, mode: PushModeSchema })
    .strict(),
  z
    .object({
      kind: z.literal("createBranch"),
      name: RefNameSchema,
      startPoint: RevisionSchema,
      checkout: z.boolean(),
    })
    .strict(),
  z
    .object({ kind: z.literal("renameBranch"), oldName: RefNameSchema, newName: RefNameSchema })
    .strict(),
  z.object({ kind: z.literal("deleteBranch"), name: RefNameSchema, force: z.boolean() }).strict(),
  z
    .object({ kind: z.literal("setUpstream"), branch: RefNameSchema, upstream: RevisionSchema })
    .strict(),
  z
    .object({
      kind: z.literal("deleteRemoteBranch"),
      remote: RefComponentSchema,
      branch: RefNameSchema,
    })
    .strict(),
  z.object({ kind: z.literal("checkout"), target: RevisionSchema, force: z.boolean() }).strict(),
  z
    .object({
      kind: z.literal("createTag"),
      name: RefNameSchema,
      revision: RevisionSchema,
      message: BoundedTextSchema.nullable(),
    })
    .strict(),
  z.object({ kind: z.literal("deleteTag"), name: RefNameSchema }).strict(),
  z
    .object({ kind: z.literal("pushTag"), remote: RefComponentSchema, name: RefNameSchema })
    .strict(),
  z
    .object({
      kind: z.literal("reset"),
      revision: RevisionSchema,
      mode: z.enum(["soft", "mixed", "hard", "keep"]),
    })
    .strict(),
  z
    .object({ kind: z.literal("revert"), revisions: RevisionsSchema, noCommit: z.boolean() })
    .strict(),
  z
    .object({ kind: z.literal("cherryPick"), revisions: RevisionsSchema, noCommit: z.boolean() })
    .strict(),
  z
    .object({
      kind: z.literal("merge"),
      revision: RevisionSchema,
      noFf: z.boolean(),
      squash: z.boolean(),
    })
    .strict(),
  z
    .object({ kind: z.literal("rebase"), onto: RevisionSchema, branch: RevisionSchema.nullable() })
    .strict(),
  z
    .object({
      kind: z.literal("interactiveRebase"),
      base: RevisionSchema.nullable(),
      entries: RebasePlanSchema,
      options: HistoryRewriteOptionsSchema,
    })
    .strict(),
  z.object({ kind: z.literal("dropCommits"), revisions: RevisionsSchema }).strict(),
  z.object({ kind: z.literal("squashCommits"), revisions: SquashRevisionsSchema }).strict(),
  z
    .object({
      kind: z.literal("rewordCommit"),
      revision: RevisionSchema,
      message: NonEmptyMessageSchema,
    })
    .strict(),
  z.object({ kind: z.literal("undoCommit") }).strict(),
  z.object({ kind: z.literal("createFixupCommit"), revision: RevisionSchema }).strict(),
  z.object({ kind: z.literal("createSquashCommit"), revision: RevisionSchema }).strict(),
  z
    .object({
      kind: z.literal("continue"),
      operation: z.enum(["merge", "rebase", "cherryPick", "revert"]),
    })
    .strict(),
  z.object({ kind: z.literal("skip"), operation: z.enum(["rebase", "cherryPick"]) }).strict(),
  z
    .object({
      kind: z.literal("abort"),
      operation: z.enum(["merge", "rebase", "cherryPick", "revert"]),
    })
    .strict(),
  z
    .object({
      kind: z.literal("stashPush"),
      message: BoundedTextSchema.nullable(),
      includeUntracked: z.boolean(),
      keepIndex: z.boolean(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("stashApply"),
      stash: RevisionSchema,
      pop: z.boolean(),
      reinstateIndex: z.boolean(),
    })
    .strict(),
  z.object({ kind: z.literal("stashDrop"), stash: RevisionSchema }).strict(),
  z.object({ kind: z.literal("stashClear") }).strict(),
  z
    .object({ kind: z.literal("stashBranch"), stash: RevisionSchema, branch: RefNameSchema })
    .strict(),
  z.object({ kind: z.literal("unshallow") }).strict(),
  z
    .object({ kind: z.literal("updateSubmodules"), init: z.boolean(), recursive: z.boolean() })
    .strict(),
  z
    .object({
      kind: z.literal("setConfig"),
      key: ConfigKeySchema,
      value: BoundedTextSchema.nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("worktreeAdd"),
      path: AbsoluteWorktreePathSchema,
      branch: RefNameSchema.nullable(),
      startPoint: RevisionSchema.nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("worktreeRemove"),
      path: AbsoluteWorktreePathSchema,
      force: z.boolean(),
    })
    .strict(),
  z.object({ kind: z.literal("remoteAdd"), name: RefComponentSchema, url: UrlSchema }).strict(),
  z.object({ kind: z.literal("remoteRemove"), name: RefComponentSchema }).strict(),
  z.object({ kind: z.literal("remoteSetUrl"), name: RefComponentSchema, url: UrlSchema }).strict(),
]);

export type ValidatedGitOperation = z.infer<typeof GitOperationSchema>;
