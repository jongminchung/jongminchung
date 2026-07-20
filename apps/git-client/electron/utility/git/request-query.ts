import type { GitRequest } from "../../../src/shared/contracts/model";
import { buildDiffArguments } from "./diff-query";
import { GitUtilityError } from "./git-error";
import { validateRelativePath, validateRevision } from "./validation";

export type QueryOnlyGitRequest = Exclude<GitRequest, Readonly<{ kind: "operation" }>>;

function validateText(value: string, field: string): void {
  if (value.length > 16_384 || value.includes("\0")) {
    throw new GitUtilityError(
      "invalidInput",
      `${field} must not exceed 16384 characters or contain null bytes`,
    );
  }
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
    throw new GitUtilityError("invalidInput", `${field} is not a safe Git ref name`);
  }
}

function validateRefComponent(value: string, field: string): void {
  validateRefName(value, field);
  if (value.includes("/")) {
    throw new GitUtilityError("invalidInput", `${field} must be a single ref component`);
  }
}

function validatePage(skip: number, limit: number): void {
  if (!Number.isSafeInteger(skip) || skip < 0) {
    throw new GitUtilityError("invalidInput", "Git query skip must be a non-negative integer");
  }
  if (!Number.isSafeInteger(limit)) {
    throw new GitUtilityError("invalidInput", "Git query limit must be an integer");
  }
}

function appendPaths(args: string[], paths: readonly string[]): void {
  if (paths.length === 0) return;
  args.push("--");
  for (const path of paths) {
    validateRelativePath(path);
    args.push(path);
  }
}

function logArguments(request: Extract<QueryOnlyGitRequest, Readonly<{ kind: "log" }>>): string[] {
  validatePage(request.skip, request.limit);
  const args = [
    "log",
    "--all",
    "--no-color",
    "--no-show-signature",
    "--decorate=full",
    "--format=%x1e%H%x00%P%x00%an%x00%ae%x00%at%x00%ct%x00%D%x00%s%x00%b%x00",
    `--skip=${request.skip}`,
    `--max-count=${Math.min(500, Math.max(1, request.limit))}`,
  ];
  if (request.order === "date") args.push("--date-order");
  else if (request.order === "topology") args.push("--topo-order");
  else args.push("--first-parent");
  if (request.filters.noMerges) args.push("--no-merges");
  if (request.filters.query !== null) {
    validateText(request.filters.query, "query");
    if (!request.filters.matchCase) args.push("--regexp-ignore-case");
    args.push(
      request.filters.regex ? "--extended-regexp" : "--fixed-strings",
      `--grep=${request.filters.query}`,
    );
  }
  if (request.filters.author !== null) {
    validateText(request.filters.author, "author");
    args.push(`--author=${request.filters.author}`);
  }
  if (request.filters.since !== null) {
    validateText(request.filters.since, "since");
    args.push(`--since=${request.filters.since}`);
  }
  if (request.filters.until !== null) {
    validateText(request.filters.until, "until");
    args.push(`--until=${request.filters.until}`);
  }
  if (request.filters.branch !== null) {
    validateRevision(request.filters.branch);
    args.push(request.filters.branch);
  }
  appendPaths(args, request.filters.paths);
  return args;
}

export function buildRequestArguments(request: QueryOnlyGitRequest): readonly string[] {
  switch (request.kind) {
    case "status":
      return [
        "status",
        "--porcelain=v2",
        "-z",
        "--branch",
        "--show-stash",
        "--untracked-files=all",
      ];
    case "refs":
      return [
        "for-each-ref",
        "--sort=refname",
        "--format=%(refname)%00%(objectname)%00%(objecttype)%00%(HEAD)%00%(upstream)%00%(upstream:track)%00%(subject)%00%(authorname)%00%(authordate:unix)%00",
        "refs/heads",
        "refs/remotes",
        "refs/tags",
      ];
    case "files":
      return ["ls-files", "--cached", "--others", "--exclude-standard", "-z"];
    case "searchText": {
      validateText(request.query, "query");
      if (request.query.length === 0) {
        throw new GitUtilityError("invalidInput", "Search query must not be empty");
      }
      const args = [
        "grep",
        "--line-number",
        "--column",
        "--null",
        "--full-name",
        "--no-color",
        "--untracked",
        "--exclude-standard",
        "--max-count=500",
        "-I",
      ];
      if (!request.options.matchCase) args.push("--ignore-case");
      if (request.options.words) args.push("--word-regexp");
      args.push(
        request.options.regex ? "--extended-regexp" : "--fixed-strings",
        "-e",
        request.query,
        "--",
      );
      return args;
    }
    case "log":
      return logArguments(request);
    case "commitDetails":
      validateRevision(request.revision);
      return [
        "show",
        "--no-color",
        "--no-ext-diff",
        "--find-renames",
        "--no-show-signature",
        "--format=%H%x00%P%x00%an%x00%ae%x00%at%x00%cn%x00%ce%x00%ct%x00%D%x00%B%x00",
        "--numstat",
        "-z",
        "--end-of-options",
        request.revision,
        "--",
      ];
    case "diff":
      return buildDiffArguments(request);
    case "tree": {
      validateRevision(request.revision);
      if (request.path === null) {
        return ["ls-tree", "-z", "-l", "--full-name", request.revision];
      }
      validateRelativePath(request.path);
      return ["ls-tree", "-z", "-l", "--full-name", `${request.revision}:${request.path}`];
    }
    case "fileHistory": {
      validateRelativePath(request.path);
      validatePage(request.skip, request.limit);
      return [
        "log",
        "--follow",
        "--no-color",
        "--no-show-signature",
        "--format=%x1e%H%x00%P%x00%an%x00%ae%x00%at%x00%D%x00%s%x00",
        `--skip=${request.skip}`,
        `--max-count=${Math.min(500, Math.max(1, request.limit))}`,
        "--",
        request.path,
      ];
    }
    case "blame": {
      validateRelativePath(request.path);
      const args = ["blame", "--line-porcelain"];
      if (request.revision !== null) {
        validateRevision(request.revision);
        args.push(request.revision);
      }
      args.push("--", request.path);
      return args;
    }
    case "stashList":
      return ["stash", "list", "--format=%x1e%gd%x00%H%x00%gs%x00%an%x00%ae%x00%at%x00"];
    case "stashShow":
      validateRevision(request.stash);
      return request.mode === "files"
        ? ["stash", "show", "--include-untracked", "--name-status", "-z", request.stash]
        : ["stash", "show", "--include-untracked", "--patch", "--no-color", request.stash];
    case "configList":
      return ["config", "--null", "--list", "--show-origin"];
    case "submoduleStatus":
      return ["submodule", "status", "--recursive"];
    case "signature":
      validateRevision(request.revision);
      return [
        "show",
        "--no-patch",
        "--format=%G?%x00%GF%x00%GS%x00%GK%x00%GT%x00",
        "--end-of-options",
        request.revision,
      ];
    case "checkIgnored": {
      const args = ["ls-files", "--others", "--ignored", "--exclude-standard", "-z"];
      appendPaths(args, request.paths);
      return args;
    }
    case "mergedBranches":
      validateRevision(request.target);
      return [
        "for-each-ref",
        `--merged=${request.target}`,
        "--format=%(refname)%00%(objectname)%00%(committerdate:unix)%00",
        "refs/heads",
      ];
    case "pushPreview":
      validateRefComponent(request.remote, "remote");
      validateRefName(request.remoteRef, "remoteRef");
      validateRevision(request.localRevision);
      if (!request.remoteRef.startsWith("refs/heads/")) {
        throw new GitUtilityError(
          "invalidInput",
          "remoteRef must be a full refs/heads branch name",
        );
      }
      return ["ls-remote", "--heads", request.remote, request.remoteRef];
    case "historyRewritePreview":
      validateRevision(request.fromRevision);
      return [
        "log",
        "--reverse",
        "--topo-order",
        "--max-count=500",
        "--format=%x1e%H%x00%P%x00%s",
        `${request.fromRevision}^..HEAD`,
      ];
  }
}
