import { access, realpath, stat } from "node:fs/promises";
import { join } from "node:path";
import type { RepositoryId } from "../../../src/shared/contracts/git-utility";
import type {
  BranchComparison,
  CommitSignature,
  GitConfig,
  InProgressOperation,
  PreCommitCheck,
  RemoteInfo,
  RepositorySnapshot,
  SubmoduleInfo,
  WorktreeInfo,
} from "../../../src/shared/contracts/model";
import { GitUtilityError } from "./git-error";
import type { GitProcessOutcome, GitProcessRunnerLike } from "./git-process";
import { redactCredentials, safeErrorMessage } from "./redaction";
import type { RepositoryRegistry } from "./repository-registry";
import { validateRelativePath, validateRevision } from "./validation";

function outputText(outcome: GitProcessOutcome, stream: "stdout" | "stderr"): string {
  return outcome.output
    .filter((entry) => entry.stream === stream)
    .map((entry) => entry.data)
    .join("");
}

function redactConfigValue(key: string, value: string): string {
  const normalizedKey = key.toLowerCase();
  if (
    normalizedKey.includes("credential") ||
    normalizedKey.includes("password") ||
    normalizedKey.includes("token") ||
    normalizedKey.endsWith("extraheader")
  ) {
    return "[redacted]";
  }
  return redactCredentials(value);
}

function containsControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x1f || codePoint === 0x7f) return true;
  }
  return false;
}

export function parseGitConfig(output: string): readonly GitConfig[] {
  const fields = output.split("\0").filter(Boolean);
  const entries: GitConfig[] = [];
  for (let index = 0; index + 2 < fields.length; index += 3) {
    const scope = fields[index] ?? "";
    const origin = fields[index + 1] ?? "";
    const valueField = fields[index + 2] ?? "";
    const separator = valueField.indexOf("\n");
    if (separator < 0) continue;
    const key = valueField.slice(0, separator);
    const value = valueField.slice(separator + 1);
    entries.push({
      key,
      value: redactConfigValue(key, value),
      origin,
      scope: scope || null,
    });
  }
  return entries;
}

export function parseSubmoduleStatus(output: string): readonly SubmoduleInfo[] {
  const entries: SubmoduleInfo[] = [];
  for (const line of output.split("\n")) {
    if (line.length === 0) continue;
    const marker = line[0] ?? " ";
    const fields = line.slice(1).trim().split(/\s+/u);
    const oid = fields[0];
    const path = fields[1];
    if (path === undefined) continue;
    const branchMatch = / \(([^)]*)\)$/u.exec(line);
    entries.push({
      path,
      oid: oid || null,
      branch: branchMatch?.[1] ?? null,
      status:
        marker === "-"
          ? "uninitialized"
          : marker === "+"
            ? "modified"
            : marker === "U"
              ? "conflicted"
              : "clean",
      initialized: marker !== "-",
    });
  }
  return entries;
}

export async function parseWorktrees(
  output: string,
  repositoryPath: string,
): Promise<readonly WorktreeInfo[]> {
  const canonicalRepository = await realpath(repositoryPath);
  const worktrees: WorktreeInfo[] = [];
  let current: WorktreeInfo | null = null;
  const finishCurrent = (): void => {
    if (current === null) return;
    worktrees.push(current);
    current = null;
  };
  for (const field of output.split("\0")) {
    if (field.length === 0) {
      finishCurrent();
      continue;
    }
    if (field.startsWith("worktree ")) {
      finishCurrent();
      const path = field.slice("worktree ".length);
      let isMain = false;
      try {
        isMain = (await realpath(path)) === canonicalRepository;
      } catch {
        // A prunable worktree can disappear between `git worktree list` and inspection.
      }
      current = {
        path,
        headOid: null,
        branch: null,
        bare: false,
        detached: false,
        locked: false,
        prunable: false,
        isMain,
      };
      continue;
    }
    if (current === null) continue;
    if (field.startsWith("HEAD ")) current.headOid = field.slice("HEAD ".length);
    else if (field.startsWith("branch ")) {
      current.branch = field.slice("branch ".length).replace(/^refs\/heads\//u, "");
    } else if (field === "bare") current.bare = true;
    else if (field === "detached") current.detached = true;
    else if (field === "locked" || field.startsWith("locked ")) current.locked = true;
    else if (field === "prunable" || field.startsWith("prunable ")) current.prunable = true;
  }
  finishCurrent();
  return worktrees;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function detectInProgressOperation(
  gitDirectory: string,
  commonDirectory: string,
): Promise<InProgressOperation | null> {
  if (
    (await pathExists(join(gitDirectory, "rebase-merge"))) ||
    (await pathExists(join(gitDirectory, "rebase-apply")))
  ) {
    return "rebase";
  }
  if (await pathExists(join(gitDirectory, "MERGE_HEAD"))) return "merge";
  if (await pathExists(join(gitDirectory, "CHERRY_PICK_HEAD"))) return "cherryPick";
  if (await pathExists(join(gitDirectory, "REVERT_HEAD"))) return "revert";
  if (await pathExists(join(commonDirectory, "BISECT_LOG"))) return "bisect";
  return null;
}

export class RepositoryInspectionService {
  readonly #registry: RepositoryRegistry;
  readonly #runner: GitProcessRunnerLike;

  constructor(registry: RepositoryRegistry, runner: GitProcessRunnerLike) {
    this.#registry = registry;
    this.#runner = runner;
  }

  async listGitConfig(repositoryId: RepositoryId): Promise<readonly GitConfig[]> {
    const output = await this.#capture(repositoryId, [
      "config",
      "--null",
      "--list",
      "--show-origin",
      "--show-scope",
    ]);
    return parseGitConfig(output);
  }

  async inspectSnapshot(repositoryId: RepositoryId): Promise<RepositorySnapshot> {
    const repository = this.#registry.get(repositoryId);
    const [headOutput, branchOutput, upstreamOutput, remoteOutput, shallowOutput, operation] =
      await Promise.all([
        this.#captureOptional(repositoryId, ["rev-parse", "--verify", "HEAD"]),
        this.#captureOptional(repositoryId, ["symbolic-ref", "--quiet", "--short", "HEAD"]),
        this.#captureOptional(repositoryId, [
          "rev-parse",
          "--abbrev-ref",
          "--symbolic-full-name",
          "@{upstream}",
        ]),
        this.#captureOptional(repositoryId, ["remote", "get-url", "origin"]),
        this.#captureOptional(repositoryId, ["rev-parse", "--is-shallow-repository"]),
        detectInProgressOperation(repository.gitDirectory, repository.commonDirectory),
      ]);
    const headOid = headOutput?.trim() || null;
    const currentBranch = branchOutput?.trim() || null;
    const upstream = upstreamOutput?.trim() || null;
    let ahead = 0;
    let behind = 0;
    if (headOid !== null && upstream !== null) {
      const counts = await this.#captureOptional(repositoryId, [
        "rev-list",
        "--left-right",
        "--count",
        "HEAD...@{upstream}",
      ]);
      const [aheadValue = "0", behindValue = "0"] = counts?.trim().split(/\s+/u) ?? [];
      ahead = Number.parseInt(aheadValue, 10) || 0;
      behind = Number.parseInt(behindValue, 10) || 0;
    }
    return {
      ...repository,
      currentBranch,
      headOid,
      upstream,
      remoteUrl: remoteOutput ? redactCredentials(remoteOutput.trim()) : null,
      ahead,
      behind,
      isShallow: shallowOutput?.trim() === "true",
      isDetached: headOid !== null && currentBranch === null,
      hasCommits: headOid !== null,
      operation,
    };
  }

  async listSubmodules(repositoryId: RepositoryId): Promise<readonly SubmoduleInfo[]> {
    return parseSubmoduleStatus(
      await this.#capture(repositoryId, ["submodule", "status", "--recursive"]),
    );
  }

  async listMergedBranches(repositoryId: RepositoryId, target: string): Promise<readonly string[]> {
    validateRevision(target);
    const output = await this.#capture(repositoryId, [
      "for-each-ref",
      `--merged=${target}`,
      "--format=%(refname:short)",
      "refs/heads",
    ]);
    return output.split("\n").filter(Boolean);
  }

  async loadCommitSignature(
    repositoryId: RepositoryId,
    revision: string,
  ): Promise<CommitSignature> {
    validateRevision(revision);
    const output = await this.#capture(repositoryId, [
      "show",
      "--no-patch",
      "--format=%G?%x00%GF%x00%GS%x00%GK%x00%GT",
      "--end-of-options",
      revision,
    ]);
    const [status = "N", fingerprint = "", signer = "", keyId = "", trust = ""] = output
      .trimEnd()
      .split("\0");
    return {
      status,
      fingerprint: fingerprint || null,
      signer: signer || null,
      keyId: keyId || null,
      trust: trust || null,
    };
  }

  async compareBranches(
    repositoryId: RepositoryId,
    left: string,
    right: string,
  ): Promise<BranchComparison> {
    validateRevision(left);
    validateRevision(right);
    const range = `${left}...${right}`;
    const counts = (
      await this.#capture(repositoryId, [
        "rev-list",
        "--left-right",
        "--count",
        "--end-of-options",
        range,
      ])
    ).trim();
    const [aheadValue = "0", behindValue = "0"] = counts.split(/\s+/u);
    const [leftOnly, rightOnly] = await Promise.all([
      this.#capture(repositoryId, [
        "rev-list",
        "--left-only",
        "--max-count=500",
        "--end-of-options",
        range,
      ]),
      this.#capture(repositoryId, [
        "rev-list",
        "--right-only",
        "--max-count=500",
        "--end-of-options",
        range,
      ]),
    ]);
    return {
      ahead: Number.parseInt(aheadValue, 10) || 0,
      behind: Number.parseInt(behindValue, 10) || 0,
      leftOnly: leftOnly.split("\n").filter(Boolean),
      rightOnly: rightOnly.split("\n").filter(Boolean),
    };
  }

  async preCommitCheck(repositoryId: RepositoryId): Promise<PreCommitCheck> {
    const repository = this.#registry.get(repositoryId);
    const branchOutput = await this.#captureOptional(repositoryId, [
      "symbolic-ref",
      "--quiet",
      "--short",
      "HEAD",
    ]);
    const branch = branchOutput?.trim() || null;
    const paths = (await this.#capture(repositoryId, ["diff", "--cached", "--name-only", "-z"]))
      .split("\0")
      .filter(Boolean);
    const crlfPaths: string[] = [];
    const largeFiles: string[] = [];
    const riskyPaths: string[] = [];
    for (const path of paths) {
      validateRelativePath(path);
      const indexObject = `:${path}`;
      const sizeOutput = await this.#captureOptional(repositoryId, ["cat-file", "-s", indexObject]);
      const size = Number.parseInt(sizeOutput?.trim() ?? "0", 10) || 0;
      if (size > 10 * 1024 * 1024) largeFiles.push(path);
      else {
        const content = await this.#captureOptional(repositoryId, ["show", indexObject]);
        if (content?.includes("\r\n") === true) crlfPaths.push(path);
      }
      if (
        path.startsWith("-") ||
        path
          .split("/")
          .some(
            (part) => part.endsWith(" ") || part.endsWith(".") || containsControlCharacter(part),
          )
      ) {
        riskyPaths.push(path);
      }
    }
    const hookNames = ["pre-commit", "prepare-commit-msg", "commit-msg"] as const;
    const hooks: string[] = [];
    for (const hookName of hookNames) {
      try {
        if ((await stat(join(repository.commonDirectory, "hooks", hookName))).isFile()) {
          hooks.push(hookName);
        }
      } catch {
        // Missing hooks are the normal case.
      }
    }
    return {
      branch,
      detachedHead: branch === null,
      protectedBranch:
        branch !== null && ["main", "master", "production", "release"].includes(branch),
      crlfPaths,
      largeFiles,
      riskyPaths,
      hooks,
    };
  }

  async listRemotes(repositoryId: RepositoryId): Promise<readonly RemoteInfo[]> {
    const names = (await this.#capture(repositoryId, ["remote"])).split("\n").filter(Boolean);
    return Promise.all(
      names.map(async (name) => ({
        name,
        fetchUrl: redactCredentials(
          (await this.#capture(repositoryId, ["remote", "get-url", name])).trim(),
        ),
        pushUrl: redactCredentials(
          (await this.#capture(repositoryId, ["remote", "get-url", "--push", name])).trim(),
        ),
      })),
    );
  }

  async listWorktrees(repositoryId: RepositoryId): Promise<readonly WorktreeInfo[]> {
    const repository = this.#registry.get(repositoryId);
    const output = await this.#capture(repositoryId, ["worktree", "list", "--porcelain", "-z"]);
    return parseWorktrees(output, repository.path);
  }

  async #capture(repositoryId: RepositoryId, args: readonly string[]): Promise<string> {
    const repository = this.#registry.get(repositoryId);
    const outcome = await this.#runner.run({ cwd: repository.path, args });
    if (outcome.kind === "completed") return outputText(outcome, "stdout");
    if (outcome.kind === "cancelled") {
      throw new GitUtilityError("commandFailed", `Git command was cancelled (${outcome.reason})`);
    }
    const stderr = outputText(outcome, "stderr");
    throw new GitUtilityError(
      outcome.code,
      safeErrorMessage(stderr || outcome.message),
      outcome.exitCode,
    );
  }

  async #captureOptional(
    repositoryId: RepositoryId,
    args: readonly string[],
  ): Promise<string | null> {
    const repository = this.#registry.get(repositoryId);
    const outcome = await this.#runner.run({ cwd: repository.path, args });
    return outcome.kind === "completed" ? outputText(outcome, "stdout") : null;
  }
}
