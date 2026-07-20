import { describe, expect, it } from "vitest";
import type { GitOperation, RebasePlanEntry } from "../../shared/contracts/model";
import {
  GitOperationSchema,
  MAX_GIT_OPERATION_PATCH_BYTES,
  type ValidatedGitOperation,
} from "./git-operation";

type IsAssignable<From, To> = [From] extends [To] ? true : false;

const generatedFitsContract: IsAssignable<GitOperation, ValidatedGitOperation> = true;
const contractFitsGenerated: IsAssignable<ValidatedGitOperation, GitOperation> = true;

const oid = "1".repeat(40);
const otherOid = "2".repeat(40);
const entry: RebasePlanEntry = {
  oid,
  subject: "subject",
  parents: [],
  action: "pick",
  message: null,
  published: false,
  mergeCommit: false,
};

const validOperations = [
  { kind: "stage", paths: ["file"] },
  { kind: "stageAll" },
  { kind: "stageTracked" },
  { kind: "addIntent", paths: ["file"] },
  { kind: "unstage", paths: ["file"] },
  { kind: "removeCached", paths: ["file"] },
  { kind: "discard", paths: ["file"] },
  { kind: "applyPatch", patch: "diff --git", cached: false, reverse: false },
  { kind: "partialPatch", patch: "@@", cached: true, reverse: true },
  {
    kind: "commit",
    message: "message",
    amend: false,
    signOff: false,
    gpgSign: false,
  },
  {
    kind: "commitAdvanced",
    message: "message",
    amend: true,
    signOff: true,
    gpgSign: true,
    skipHooks: true,
    commitAll: true,
  },
  { kind: "fetch", remote: "origin", prune: true },
  { kind: "pull", rebase: true },
  {
    kind: "push",
    destination: {
      remote: "origin",
      remoteRef: "refs/heads/main",
      localRevision: "HEAD",
      setUpstream: true,
    },
    mode: { kind: "forceWithLease", expectedRemoteOid: oid },
  },
  { kind: "createBranch", name: "feature", startPoint: "HEAD", checkout: true },
  { kind: "renameBranch", oldName: "old", newName: "new" },
  { kind: "deleteBranch", name: "old", force: true },
  { kind: "setUpstream", branch: "main", upstream: "origin/main" },
  { kind: "deleteRemoteBranch", remote: "origin", branch: "feature" },
  { kind: "checkout", target: "main", force: true },
  { kind: "createTag", name: "v1", revision: "HEAD", message: "release" },
  { kind: "deleteTag", name: "v1" },
  { kind: "pushTag", remote: "origin", name: "v1" },
  { kind: "reset", revision: "HEAD^", mode: "mixed" },
  { kind: "revert", revisions: [oid], noCommit: true },
  { kind: "cherryPick", revisions: [oid], noCommit: false },
  { kind: "merge", revision: "feature", noFf: true, squash: false },
  { kind: "rebase", onto: "main", branch: "feature" },
  {
    kind: "interactiveRebase",
    base: "HEAD^",
    entries: [entry],
    options: { autostash: true, updateRefs: true, preserveMerges: true },
  },
  { kind: "dropCommits", revisions: [oid] },
  { kind: "squashCommits", revisions: [otherOid, oid] },
  { kind: "rewordCommit", revision: oid, message: "new message" },
  { kind: "undoCommit" },
  { kind: "createFixupCommit", revision: oid },
  { kind: "createSquashCommit", revision: oid },
  { kind: "continue", operation: "rebase" },
  { kind: "skip", operation: "cherryPick" },
  { kind: "abort", operation: "merge" },
  { kind: "stashPush", message: "save", includeUntracked: true, keepIndex: true },
  { kind: "stashApply", stash: "stash@{0}", pop: true, reinstateIndex: true },
  { kind: "stashDrop", stash: "stash@{0}" },
  { kind: "stashClear" },
  { kind: "stashBranch", stash: "stash@{0}", branch: "from-stash" },
  { kind: "unshallow" },
  { kind: "updateSubmodules", init: true, recursive: true },
  { kind: "setConfig", key: "user.name", value: "Person" },
  { kind: "worktreeAdd", path: "/tmp/worktree", branch: "work", startPoint: "HEAD" },
  { kind: "worktreeRemove", path: "/tmp/worktree", force: true },
  { kind: "remoteAdd", name: "upstream", url: "https://example.invalid/repo.git" },
  { kind: "remoteRemove", name: "upstream" },
  { kind: "remoteSetUrl", name: "origin", url: "ssh://example.invalid/repo.git" },
] satisfies readonly GitOperation[];

const commandBuilderInvalidOperations: readonly GitOperation[] = [
  { kind: "stage", paths: [] },
  { kind: "discard", paths: ["../secret"] },
  { kind: "commit", message: " ", amend: false, signOff: false, gpgSign: false },
  { kind: "fetch", remote: "origin/other", prune: false },
  {
    kind: "push",
    destination: {
      remote: "origin",
      remoteRef: "refs/heads/main",
      localRevision: "HEAD",
      setUpstream: false,
    },
    mode: { kind: "forceWithLease", expectedRemoteOid: "abc" },
  },
  { kind: "remoteAdd", name: "origin", url: "--upload-pack=evil" },
  { kind: "squashCommits", revisions: [oid] },
  {
    kind: "interactiveRebase",
    base: null,
    entries: [{ ...entry, action: "squash" }],
    options: { autostash: false, updateRefs: false, preserveMerges: false },
  },
];

function interactiveRebase(entries: readonly unknown[]): unknown {
  return {
    kind: "interactiveRebase",
    base: null,
    entries,
    options: { autostash: false, updateRefs: false, preserveMerges: false },
  };
}

describe("GitOperationSchema", () => {
  it("is compile-time compatible with the generated GitOperation in both directions", () => {
    expect(generatedFitsContract).toBe(true);
    expect(contractFitsGenerated).toBe(true);
  });

  it("contains one valid fixture for each of the 51 generated operation kinds", () => {
    expect(validOperations).toHaveLength(51);
    expect(new Set(validOperations.map(({ kind }) => kind)).size).toBe(51);
  });

  it.each(validOperations)("accepts the operation-command fixture for $kind", (operation) => {
    expect(GitOperationSchema.parse(operation)).toEqual(operation);
  });

  it("rejects every abuse case already rejected by operation command construction", () => {
    for (const operation of commandBuilderInvalidOperations) {
      expect(GitOperationSchema.safeParse(operation).success).toBe(false);
    }
  });

  it("rejects unknown, non-strict, missing, oversized, and unsafe operation fields", () => {
    const invalid: readonly unknown[] = [
      { kind: "unknown" },
      { kind: "stageAll", unexpected: true },
      { kind: "stage" },
      { kind: "stage", paths: ["file"], unexpected: true },
      { kind: "stage", paths: Array.from({ length: 10_001 }, () => "file") },
      { kind: "stage", paths: ["folder/../../secret"] },
      { kind: "checkout", target: "--all", force: false },
      { kind: "checkout", target: "HEAD\nmain", force: false },
      { kind: "createBranch", name: "bad..branch", startPoint: "HEAD", checkout: false },
      {
        kind: "push",
        destination: {
          remote: "origin",
          remoteRef: "refs/tags/not-a-branch",
          localRevision: "HEAD",
          setUpstream: false,
          unexpected: true,
        },
        mode: { kind: "normal" },
      },
      { kind: "worktreeAdd", path: "relative/worktree", branch: null, startPoint: null },
      { kind: "worktreeRemove", path: "/tmp/worktree\0escape", force: false },
      { kind: "setConfig", key: "unsafe", value: "value" },
      { kind: "remoteSetUrl", name: "origin", url: "-oProxyCommand=evil" },
      { kind: "revert", revisions: Array.from({ length: 501 }, () => oid), noCommit: true },
    ];
    for (const operation of invalid) {
      expect(GitOperationSchema.safeParse(operation).success).toBe(false);
    }
  });

  it("bounds patch content by UTF-8 bytes", () => {
    const maximumPatch = "x".repeat(MAX_GIT_OPERATION_PATCH_BYTES);
    expect(
      GitOperationSchema.safeParse({
        kind: "applyPatch",
        patch: maximumPatch,
        cached: false,
        reverse: false,
      }).success,
    ).toBe(true);
    expect(
      GitOperationSchema.safeParse({
        kind: "partialPatch",
        patch: `${maximumPatch}x`,
        cached: false,
        reverse: false,
      }).success,
    ).toBe(false);
    expect(
      GitOperationSchema.safeParse({
        kind: "applyPatch",
        patch: "é".repeat(MAX_GIT_OPERATION_PATCH_BYTES / 2 + 1),
        cached: false,
        reverse: false,
      }).success,
    ).toBe(false);
  });

  it("enforces rebase plan bounds, identifiers, and action/message relationships", () => {
    const tooManyEntries = Array.from({ length: 501 }, (_, index) => ({
      ...entry,
      oid: index.toString(16).padStart(40, "0"),
    }));
    const invalid: readonly unknown[] = [
      interactiveRebase([]),
      interactiveRebase(tooManyEntries),
      interactiveRebase([{ ...entry, oid: "abc" }]),
      interactiveRebase([{ ...entry, parents: ["abc"] }]),
      interactiveRebase([{ ...entry, action: "unknown" }]),
      interactiveRebase([{ ...entry, action: "reword", message: null }]),
      interactiveRebase([{ ...entry, action: "reword", message: " " }]),
      interactiveRebase([{ ...entry, mergeCommit: true, action: "edit" }]),
      interactiveRebase([{ ...entry, action: "fixup" }]),
      interactiveRebase([{ ...entry, action: "drop" }]),
      interactiveRebase([entry, { ...entry }]),
      interactiveRebase([{ ...entry, unexpected: true }]),
    ];
    for (const operation of invalid) {
      expect(GitOperationSchema.safeParse(operation).success).toBe(false);
    }

    expect(
      GitOperationSchema.safeParse(
        interactiveRebase([
          entry,
          { ...entry, oid: otherOid, action: "reword", message: "new message" },
        ]),
      ).success,
    ).toBe(true);
  });
});
