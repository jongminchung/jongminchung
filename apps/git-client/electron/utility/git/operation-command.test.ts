import { describe, expect, it } from "vitest";
import type { GitOperation, RebasePlanEntry } from "../../../src/shared/contracts/model";
import { buildOperationCommand } from "./operation-command";

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

const operations: readonly GitOperation[] = [
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
  {
    kind: "createBranch",
    name: "feature",
    startPoint: "HEAD",
    checkout: true,
  },
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
  {
    kind: "stashPush",
    message: "save",
    includeUntracked: true,
    keepIndex: true,
  },
  { kind: "stashApply", stash: "stash@{0}", pop: true, reinstateIndex: true },
  { kind: "stashDrop", stash: "stash@{0}" },
  { kind: "stashClear" },
  { kind: "stashBranch", stash: "stash@{0}", branch: "from-stash" },
  { kind: "unshallow" },
  { kind: "updateSubmodules", init: true, recursive: true },
  { kind: "setConfig", key: "user.name", value: "Person" },
  {
    kind: "worktreeAdd",
    path: "/tmp/worktree",
    branch: "work",
    startPoint: "HEAD",
  },
  { kind: "worktreeRemove", path: "/tmp/worktree", force: true },
  {
    kind: "remoteAdd",
    name: "upstream",
    url: "https://example.invalid/repo.git",
  },
  { kind: "remoteRemove", name: "upstream" },
  {
    kind: "remoteSetUrl",
    name: "origin",
    url: "ssh://example.invalid/repo.git",
  },
];

describe("buildOperationCommand", () => {
  it.each(operations)("builds the fixed command for $kind", (operation) => {
    const command = buildOperationCommand(operation);
    expect(command.args.length).toBeGreaterThan(0);
    expect(command.args).not.toContain("");
    expect(command.kind === "sequence" || command.args[0] !== "git").toBe(true);
  });

  it("preserves stdin without placing patch content in argv", () => {
    const command = buildOperationCommand({
      kind: "applyPatch",
      patch: "secret patch content",
      cached: true,
      reverse: false,
    });
    expect(command).toMatchObject({
      kind: "process",
      stdin: "secret patch content",
    });
    expect(command.args).not.toContain("secret patch content");
  });

  it("builds explicit sequence-helper commands without renderer-supplied environment", () => {
    expect(
      buildOperationCommand({
        kind: "interactiveRebase",
        base: null,
        entries: [entry],
        options: {
          autostash: false,
          updateRefs: false,
          preserveMerges: false,
        },
      }),
    ).toMatchObject({
      kind: "sequence",
      action: "plan",
      args: ["rebase", "--interactive", "--root"],
      entries: [entry],
    });
  });

  it("rejects traversal, empty selections/messages, unsafe refs and URLs, bad leases, and invalid plans", () => {
    const invalid: readonly GitOperation[] = [
      { kind: "stage", paths: [] },
      { kind: "discard", paths: ["../secret"] },
      {
        kind: "commit",
        message: " ",
        amend: false,
        signOff: false,
        gpgSign: false,
      },
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
        options: {
          autostash: false,
          updateRefs: false,
          preserveMerges: false,
        },
      },
    ];
    for (const operation of invalid) expect(() => buildOperationCommand(operation)).toThrow();
  });
});
