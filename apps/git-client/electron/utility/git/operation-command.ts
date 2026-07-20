import { Buffer } from "node:buffer";
import { isAbsolute } from "node:path";
import type { GitOperation, RebasePlanEntry } from "../../../src/shared/contracts/model";
import { GitUtilityError } from "./git-error";
import { validateRelativePath, validateRevision } from "./validation";

export interface ProcessOperationCommand {
  readonly kind: "process";
  readonly args: readonly string[];
  readonly stdin?: string;
}

export interface SequenceOperationCommand {
  readonly kind: "sequence";
  readonly args: readonly string[];
  readonly action: "plan" | "drop" | "squash" | "reword";
  readonly entries?: readonly RebasePlanEntry[];
  readonly revisions?: readonly string[];
  readonly message?: string;
  readonly preserveMerges: boolean;
}

export type GitOperationCommand = ProcessOperationCommand | SequenceOperationCommand;

function invalid(message: string): never {
  throw new GitUtilityError("invalidInput", message);
}

function validateText(value: string, field: string): void {
  if (value.includes("\0")) invalid(`${field} must not contain a null byte`);
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

function validateRefName(value: string, field: string): void {
  validateText(value, field);
  if (
    value.length === 0 ||
    /^[-./]/u.test(value) ||
    /[./]$/u.test(value) ||
    value.endsWith(".lock") ||
    value.includes("..") ||
    value.includes("@{") ||
    value.includes("//") ||
    hasInvalidRefCharacter(value)
  ) {
    invalid(`${field} is not a safe Git ref name`);
  }
}

function validateRefComponent(value: string, field: string): void {
  validateRefName(value, field);
  if (value.includes("/")) invalid(`${field} must be a single ref component`);
}

function validateObjectOid(value: string, field: string): void {
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/iu.test(value)) {
    invalid(`${field} must be an exact hexadecimal object ID`);
  }
}

function validateRevisions(revisions: readonly string[]): void {
  if (revisions.length === 0) invalid("revisions must contain at least one revision");
  for (const revision of revisions) validateRevision(revision);
}

function appendPaths(args: string[], paths: readonly string[], required = false): void {
  if (paths.length === 0) {
    if (required) invalid("paths must contain at least one path");
    return;
  }
  args.push("--");
  for (const path of paths) {
    validateRelativePath(path);
    args.push(path);
  }
}

function validateConfigKey(key: string): void {
  validateText(key, "key");
  if (
    key.length === 0 ||
    /^[.-]/u.test(key) ||
    key.endsWith(".") ||
    !key.includes(".") ||
    !/^[A-Za-z0-9.-]+$/u.test(key)
  ) {
    invalid("key must be a safe Git config key");
  }
}

function validateUrl(url: string): void {
  validateText(url, "url");
  if (url.length === 0 || url.startsWith("-")) invalid("url must not be an option");
}

function validateWorktreePath(path: string): void {
  validateText(path, "worktreePath");
  if (!isAbsolute(path)) invalid("worktreePath must be an absolute path selected by the user");
}

function commitArguments(
  message: string,
  amend: boolean,
  signOff: boolean,
  gpgSign: boolean,
  skipHooks: boolean,
  commitAll: boolean,
): string[] {
  validateText(message, "message");
  if (message.trim().length === 0) invalid("message must not be empty");
  const args = ["commit", "--message", message];
  if (amend) args.push("--amend");
  if (signOff) args.push("--signoff");
  if (gpgSign) args.push("--gpg-sign");
  if (skipHooks) args.push("--no-verify");
  if (commitAll) args.push("--all");
  return args;
}

function validateRebasePlan(entries: readonly RebasePlanEntry[]): void {
  if (entries.length === 0 || entries.length > 500) {
    invalid("entries must contain between 1 and 500 commits");
  }
  const seen = new Set<string>();
  let hasTarget = false;
  for (const entry of entries) {
    validateObjectOid(entry.oid, "entryOid");
    if (seen.has(entry.oid)) invalid("entries must not contain duplicate commits");
    seen.add(entry.oid);
    if (entry.mergeCommit && entry.action !== "pick") {
      invalid("merge commits must remain pick entries");
    }
    if (entry.action === "reword") {
      const message = entry.message ?? "";
      validateText(message, "message");
      if (message.trim().length === 0) {
        invalid("reword entries require a non-empty message");
      }
    }
    if ((entry.action === "squash" || entry.action === "fixup") && !hasTarget) {
      invalid("squash and fixup require an earlier picked commit");
    }
    if (entry.action !== "drop") hasTarget = true;
  }
  if (!hasTarget) invalid("cannot drop every commit in the branch");
}

function continuationArguments(operation: "merge" | "rebase" | "cherryPick" | "revert"): string[] {
  return [operation === "cherryPick" ? "cherry-pick" : operation, "--continue"];
}

function abortArguments(operation: "merge" | "rebase" | "cherryPick" | "revert"): string[] {
  return [operation === "cherryPick" ? "cherry-pick" : operation, "--abort"];
}

export function buildOperationCommand(operation: GitOperation): GitOperationCommand {
  switch (operation.kind) {
    case "stage": {
      const args = ["add"];
      appendPaths(args, operation.paths, true);
      return { kind: "process", args };
    }
    case "stageAll":
      return { kind: "process", args: ["add", "--all"] };
    case "stageTracked":
      return { kind: "process", args: ["add", "--update"] };
    case "addIntent": {
      const args = ["add", "--intent-to-add"];
      appendPaths(args, operation.paths, true);
      return { kind: "process", args };
    }
    case "unstage": {
      const args = ["restore", "--staged"];
      appendPaths(args, operation.paths, true);
      return { kind: "process", args };
    }
    case "removeCached": {
      const args = ["rm", "--cached", "--ignore-unmatch"];
      appendPaths(args, operation.paths, true);
      return { kind: "process", args };
    }
    case "discard": {
      const args = ["restore", "--worktree"];
      appendPaths(args, operation.paths, true);
      return { kind: "process", args };
    }
    case "applyPatch": {
      validateText(operation.patch, "patch");
      const args = ["apply", "--3way", "--whitespace=nowarn"];
      if (operation.cached) args.push("--cached");
      if (operation.reverse) args.push("--reverse");
      args.push("-");
      return { kind: "process", args, stdin: operation.patch };
    }
    case "partialPatch": {
      validateText(operation.patch, "patch");
      if (Buffer.byteLength(operation.patch, "utf8") > 5 * 1024 * 1024) {
        invalid("patch must not exceed 5 MiB");
      }
      const args = ["apply", "--unidiff-zero", "--whitespace=nowarn"];
      if (operation.cached) args.push("--cached");
      if (operation.reverse) args.push("--reverse");
      args.push("-");
      return { kind: "process", args, stdin: operation.patch };
    }
    case "commit":
      return {
        kind: "process",
        args: commitArguments(
          operation.message,
          operation.amend,
          operation.signOff,
          operation.gpgSign,
          false,
          false,
        ),
      };
    case "commitAdvanced":
      return {
        kind: "process",
        args: commitArguments(
          operation.message,
          operation.amend,
          operation.signOff,
          operation.gpgSign,
          operation.skipHooks,
          operation.commitAll,
        ),
      };
    case "fetch": {
      const args = ["fetch"];
      if (operation.prune) args.push("--prune");
      if (operation.remote !== null) {
        validateRefComponent(operation.remote, "remote");
        args.push(operation.remote);
      }
      return { kind: "process", args };
    }
    case "pull":
      return {
        kind: "process",
        args: operation.rebase ? ["pull", "--rebase"] : ["pull"],
      };
    case "push": {
      validateRefComponent(operation.destination.remote, "remote");
      validateRefName(operation.destination.remoteRef, "remoteRef");
      validateRevision(operation.destination.localRevision);
      if (!operation.destination.remoteRef.startsWith("refs/heads/")) {
        invalid("remoteRef must be a full refs/heads branch name");
      }
      const args = ["push"];
      if (operation.destination.setUpstream) args.push("--set-upstream");
      if (operation.mode.kind === "forceWithLease") {
        validateObjectOid(operation.mode.expectedRemoteOid, "expectedRemoteOid");
        args.push(
          `--force-with-lease=${operation.destination.remoteRef}:${operation.mode.expectedRemoteOid}`,
        );
      }
      args.push(
        operation.destination.remote,
        `${operation.destination.localRevision}:${operation.destination.remoteRef}`,
      );
      return { kind: "process", args };
    }
    case "createBranch":
      validateRefName(operation.name, "branch");
      validateRevision(operation.startPoint);
      return {
        kind: "process",
        args: operation.checkout
          ? ["switch", "--create", operation.name, operation.startPoint]
          : ["branch", operation.name, operation.startPoint],
      };
    case "renameBranch":
      validateRefName(operation.oldName, "oldName");
      validateRefName(operation.newName, "newName");
      return {
        kind: "process",
        args: ["branch", "--move", operation.oldName, operation.newName],
      };
    case "deleteBranch":
      validateRefName(operation.name, "branch");
      return {
        kind: "process",
        args: ["branch", operation.force ? "--delete-force" : "--delete", operation.name],
      };
    case "setUpstream":
      validateRefName(operation.branch, "branch");
      validateRevision(operation.upstream);
      return {
        kind: "process",
        args: ["branch", "--set-upstream-to", operation.upstream, operation.branch],
      };
    case "deleteRemoteBranch":
      validateRefComponent(operation.remote, "remote");
      validateRefName(operation.branch, "branch");
      return {
        kind: "process",
        args: ["push", operation.remote, "--delete", operation.branch],
      };
    case "checkout": {
      validateRevision(operation.target);
      const args = ["checkout"];
      if (operation.force) args.push("--force");
      args.push(operation.target);
      return { kind: "process", args };
    }
    case "createTag": {
      validateRefName(operation.name, "tag");
      validateRevision(operation.revision);
      const args = ["tag"];
      if (operation.message !== null) {
        validateText(operation.message, "message");
        args.push("--annotate", "--message", operation.message);
      }
      args.push(operation.name, operation.revision);
      return { kind: "process", args };
    }
    case "deleteTag":
      validateRefName(operation.name, "tag");
      return {
        kind: "process",
        args: ["tag", "--delete", operation.name],
      };
    case "pushTag":
      validateRefComponent(operation.remote, "remote");
      validateRefName(operation.name, "tag");
      return {
        kind: "process",
        args: ["push", operation.remote, `refs/tags/${operation.name}`],
      };
    case "reset":
      validateRevision(operation.revision);
      return {
        kind: "process",
        args: ["reset", `--${operation.mode}`, operation.revision],
      };
    case "revert": {
      validateRevisions(operation.revisions);
      const args = ["revert"];
      if (operation.noCommit) args.push("--no-commit");
      args.push(...operation.revisions);
      return { kind: "process", args };
    }
    case "cherryPick": {
      validateRevisions(operation.revisions);
      const args = ["cherry-pick"];
      if (operation.noCommit) args.push("--no-commit");
      args.push(...operation.revisions);
      return { kind: "process", args };
    }
    case "merge": {
      validateRevision(operation.revision);
      const args = ["merge"];
      if (operation.noFf) args.push("--no-ff");
      if (operation.squash) args.push("--squash");
      args.push(operation.revision);
      return { kind: "process", args };
    }
    case "rebase": {
      validateRevision(operation.onto);
      const args = ["rebase", "--autostash", operation.onto];
      if (operation.branch !== null) {
        validateRevision(operation.branch);
        args.push(operation.branch);
      }
      return { kind: "process", args };
    }
    case "interactiveRebase": {
      validateRebasePlan(operation.entries);
      const args = ["rebase", "--interactive"];
      if (operation.options.preserveMerges) args.push("--rebase-merges");
      if (operation.options.autostash) args.push("--autostash");
      if (operation.options.updateRefs) args.push("--update-refs");
      if (operation.base === null) args.push("--root");
      else {
        validateRevision(operation.base);
        args.push(operation.base);
      }
      return {
        kind: "sequence",
        args,
        action: "plan",
        entries: operation.entries,
        preserveMerges: operation.options.preserveMerges,
      };
    }
    case "dropCommits": {
      validateRevisions(operation.revisions);
      const oldest = operation.revisions.at(-1);
      if (oldest === undefined) invalid("revisions must not be empty");
      return {
        kind: "sequence",
        args: ["rebase", "--interactive", "--rebase-merges", "--autostash", `${oldest}^`],
        action: "drop",
        revisions: operation.revisions,
        preserveMerges: true,
      };
    }
    case "squashCommits": {
      validateRevisions(operation.revisions);
      if (operation.revisions.length < 2) {
        invalid("revisions must contain at least two commits for squash");
      }
      const oldest = operation.revisions.at(-1);
      if (oldest === undefined) invalid("revisions must not be empty");
      return {
        kind: "sequence",
        args: ["rebase", "--interactive", "--rebase-merges", "--autostash", `${oldest}^`],
        action: "squash",
        revisions: operation.revisions,
        preserveMerges: true,
      };
    }
    case "rewordCommit":
      validateRevision(operation.revision);
      validateText(operation.message, "message");
      if (operation.message.trim().length === 0) invalid("message must not be empty");
      return {
        kind: "sequence",
        args: ["rebase", "--interactive", "--rebase-merges", "--autostash", "--root"],
        action: "reword",
        revisions: [operation.revision],
        message: operation.message,
        preserveMerges: true,
      };
    case "undoCommit":
      return { kind: "process", args: ["reset", "--soft", "HEAD^"] };
    case "createFixupCommit":
      validateRevision(operation.revision);
      return {
        kind: "process",
        args: ["commit", `--fixup=${operation.revision}`],
      };
    case "createSquashCommit":
      validateRevision(operation.revision);
      return {
        kind: "process",
        args: ["commit", `--squash=${operation.revision}`],
      };
    case "continue":
      return {
        kind: "process",
        args: continuationArguments(operation.operation),
      };
    case "skip":
      return {
        kind: "process",
        args: [operation.operation === "cherryPick" ? "cherry-pick" : "rebase", "--skip"],
      };
    case "abort":
      return {
        kind: "process",
        args: abortArguments(operation.operation),
      };
    case "stashPush": {
      const args = ["stash", "push"];
      if (operation.includeUntracked) args.push("--include-untracked");
      if (operation.keepIndex) args.push("--keep-index");
      if (operation.message !== null) {
        validateText(operation.message, "message");
        args.push("--message", operation.message);
      }
      return { kind: "process", args };
    }
    case "stashApply": {
      validateRevision(operation.stash);
      const args = ["stash", operation.pop ? "pop" : "apply"];
      if (operation.reinstateIndex) args.push("--index");
      args.push(operation.stash);
      return { kind: "process", args };
    }
    case "stashDrop":
      validateRevision(operation.stash);
      return {
        kind: "process",
        args: ["stash", "drop", operation.stash],
      };
    case "stashClear":
      return { kind: "process", args: ["stash", "clear"] };
    case "stashBranch":
      validateRevision(operation.stash);
      validateRefName(operation.branch, "branch");
      return {
        kind: "process",
        args: ["stash", "branch", operation.branch, operation.stash],
      };
    case "unshallow":
      return { kind: "process", args: ["fetch", "--unshallow"] };
    case "updateSubmodules": {
      const args = ["submodule", "update"];
      if (operation.init) args.push("--init");
      if (operation.recursive) args.push("--recursive");
      return { kind: "process", args };
    }
    case "setConfig": {
      validateConfigKey(operation.key);
      const args = ["config", "--local"];
      if (operation.value === null) args.push("--unset-all", operation.key);
      else {
        validateText(operation.value, "value");
        args.push(operation.key, operation.value);
      }
      return { kind: "process", args };
    }
    case "worktreeAdd": {
      validateWorktreePath(operation.path);
      const args = ["worktree", "add"];
      if (operation.branch !== null) {
        validateRefName(operation.branch, "branch");
        args.push("-b", operation.branch);
      }
      args.push(operation.path);
      if (operation.startPoint !== null) {
        validateRevision(operation.startPoint);
        args.push(operation.startPoint);
      }
      return { kind: "process", args };
    }
    case "worktreeRemove": {
      validateWorktreePath(operation.path);
      const args = ["worktree", "remove"];
      if (operation.force) args.push("--force");
      args.push(operation.path);
      return { kind: "process", args };
    }
    case "remoteAdd":
      validateRefComponent(operation.name, "remote");
      validateUrl(operation.url);
      return {
        kind: "process",
        args: ["remote", "add", operation.name, operation.url],
      };
    case "remoteRemove":
      validateRefComponent(operation.name, "remote");
      return {
        kind: "process",
        args: ["remote", "remove", operation.name],
      };
    case "remoteSetUrl":
      validateRefComponent(operation.name, "remote");
      validateUrl(operation.url);
      return {
        kind: "process",
        args: ["remote", "set-url", operation.name, operation.url],
      };
  }
}
