import type { Stats } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import {
  FileSourceSchema,
  type FileSource,
  type GitSubmoduleInfo,
  type RepositoryId,
} from "../../../src/shared/contracts/git-utility";
import type { SubmoduleDiff } from "../../../src/shared/contracts/model";
import { GitUtilityError } from "./git-error";
import { GitProcessRunner, type GitProcessOutcome, type GitProcessRunnerLike } from "./git-process";
import type { RepositoryRegistry } from "./repository-registry";
import { validateRelativePath, validateRevision } from "./validation";

const SUBMODULE_OUTPUT_LIMIT_BYTES = 4 * 1024 * 1024;
const MAXIMUM_NESTED_SUBMODULES = 10_000;
const OBJECT_ID_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u;

interface PathIdentity {
  readonly device: number;
  readonly inode: number;
}

interface DirectoryPin {
  readonly path: string;
  readonly identity: PathIdentity;
}

export interface SubmoduleWorktreeState {
  readonly present: boolean;
  readonly initialized: boolean;
  readonly headOid: string | null;
  readonly branch: string | null;
  readonly detached: boolean;
  readonly dirty: boolean | null;
}

export interface NestedSubmoduleMetadata extends GitSubmoduleInfo {
  readonly dirty: boolean | null;
}

export interface SubmoduleDiffFoundation {
  readonly diff: Readonly<SubmoduleDiff>;
  readonly worktree: SubmoduleWorktreeState;
  readonly nestedSubmodules: readonly NestedSubmoduleMetadata[];
}

function outputText(outcome: GitProcessOutcome): string {
  return outcome.output
    .filter((entry) => entry.stream === "stdout")
    .map((entry) => entry.data)
    .join("");
}

function identity(metadata: Stats): PathIdentity {
  return { device: metadata.dev, inode: metadata.ino };
}

function isSameIdentity(metadata: Stats, expected: PathIdentity): boolean {
  return metadata.dev === expected.device && metadata.ino === expected.inode;
}

function isInside(root: string, path: string): boolean {
  const child = relative(root, path);
  return child.length > 0 && child !== ".." && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}

function isMissingPathError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "ENOENT" || error.code === "ENOTDIR")
  );
}

function invalidInput(message: string): GitUtilityError {
  return new GitUtilityError("invalidInput", message);
}

function parseObjectId(value: string): string | null {
  const oid = value.trim().toLowerCase();
  return OBJECT_ID_PATTERN.test(oid) ? oid : null;
}

function parseFileSource(source: FileSource): FileSource {
  const result = FileSourceSchema.safeParse(source);
  if (!result.success) throw invalidInput("File source is invalid");
  if (result.data.kind === "revision") {
    validateRevision(result.data.revision);
  }
  return result.data;
}

function parseGitlinkOid(output: string, source: FileSource): string | null {
  const record = output.split("\0", 1)[0]?.trim() ?? "";
  if (record.length === 0) return null;
  const expression =
    source.kind === "index"
      ? /^160000 ([0-9a-fA-F]{40}|[0-9a-fA-F]{64}) 0\t/u
      : /^160000 commit ([0-9a-fA-F]{40}|[0-9a-fA-F]{64})\t/u;
  return parseObjectId(expression.exec(record)?.[1] ?? "");
}

export function parseNestedSubmoduleStatus(output: string): readonly GitSubmoduleInfo[] {
  const entries: GitSubmoduleInfo[] = [];
  for (const line of output.split("\n")) {
    if (line.length === 0) continue;
    if (entries.length >= MAXIMUM_NESTED_SUBMODULES) {
      throw new GitUtilityError(
        "outputLimit",
        `Nested submodule count exceeded ${MAXIMUM_NESTED_SUBMODULES}`,
      );
    }

    const marker = line[0] ?? "";
    if (![" ", "-", "+", "U"].includes(marker)) {
      throw new GitUtilityError(
        "commandFailed",
        "Git returned an invalid nested submodule status marker",
      );
    }
    const branchMatch = / \(([^()]*)\)$/u.exec(line);
    const bodyEnd = branchMatch?.index ?? line.length;
    const body = line.slice(1, bodyEnd);
    const separatorIndex = body.indexOf(" ");
    if (separatorIndex < 1) {
      throw new GitUtilityError(
        "commandFailed",
        "Git returned malformed nested submodule metadata",
      );
    }
    const oid = parseObjectId(body.slice(0, separatorIndex));
    const path = body.slice(separatorIndex + 1);
    if (oid === null || path.length === 0) {
      throw new GitUtilityError(
        "commandFailed",
        "Git returned malformed nested submodule metadata",
      );
    }
    validateRelativePath(path);
    entries.push(
      Object.freeze({
        path,
        oid,
        branch:
          branchMatch === null || branchMatch[1]?.length === 0 ? null : (branchMatch[1] ?? null),
        status:
          marker === "-"
            ? "uninitialized"
            : marker === "+"
              ? "modified"
              : marker === "U"
                ? "conflicted"
                : "clean",
        initialized: marker !== "-",
      }),
    );
  }
  return Object.freeze(entries);
}

export class SubmoduleDiffService {
  readonly #registry: RepositoryRegistry;
  readonly #runner: GitProcessRunnerLike;

  constructor(registry: RepositoryRegistry, runner: GitProcessRunnerLike = new GitProcessRunner()) {
    this.#registry = registry;
    this.#runner = runner;
  }

  async loadSubmoduleDiff(
    repositoryId: RepositoryId,
    beforeValue: FileSource,
    afterValue: FileSource,
    path: string,
    signal?: AbortSignal,
  ): Promise<SubmoduleDiffFoundation> {
    validateRelativePath(path);
    const before = parseFileSource(beforeValue);
    const after = parseFileSource(afterValue);
    const repository = this.#registry.get(repositoryId);
    const root = await this.#pinDirectory(repository.path, false);
    const directory = repository.isBare
      ? null
      : await this.#resolveSubmoduleDirectory(root.path, path);

    const beforeOid = await this.#submoduleOid(
      root.path,
      directory?.path ?? null,
      before,
      path,
      signal,
    );
    const afterOid = await this.#submoduleOid(
      root.path,
      directory?.path ?? null,
      after,
      path,
      signal,
    );
    const beforeSubject = await this.#subject(directory?.path ?? null, beforeOid, signal);
    const afterSubject = await this.#subject(directory?.path ?? null, afterOid, signal);
    const counts = await this.#aheadBehind(directory?.path ?? null, beforeOid, afterOid, signal);
    const worktree = await this.#worktreeState(directory, signal);
    const nestedSubmodules = await this.#nestedSubmodules(directory, worktree.initialized, signal);

    await this.#verifyDirectoryPin(repository.path, root);
    if (directory !== null) {
      await this.#verifyDirectoryPin(join(root.path, path), directory);
    }

    return Object.freeze({
      diff: Object.freeze({
        path,
        beforeOid,
        afterOid,
        beforeSubject,
        afterSubject,
        ahead: counts?.ahead ?? null,
        behind: counts?.behind ?? null,
      }),
      worktree,
      nestedSubmodules,
    });
  }

  async #submoduleOid(
    root: string,
    directory: string | null,
    source: FileSource,
    path: string,
    signal?: AbortSignal,
  ): Promise<string | null> {
    if (source.kind === "workingTree") {
      if (directory === null) return null;
      const output = await this.#captureOptional(
        directory,
        ["rev-parse", "--verify", "HEAD"],
        signal,
      );
      return output === null ? null : parseObjectId(output);
    }

    const output = await this.#captureOptional(
      root,
      source.kind === "index"
        ? ["ls-files", "--stage", "-z", "--", path]
        : ["ls-tree", "-z", source.revision, "--", path],
      signal,
    );
    return output === null ? null : parseGitlinkOid(output, source);
  }

  async #subject(
    directory: string | null,
    oid: string | null,
    signal?: AbortSignal,
  ): Promise<string | null> {
    if (directory === null || oid === null) return null;
    const output = await this.#captureOptional(
      directory,
      ["show", "-s", "--format=%s", oid],
      signal,
    );
    return output?.trim() || null;
  }

  async #aheadBehind(
    directory: string | null,
    beforeOid: string | null,
    afterOid: string | null,
    signal?: AbortSignal,
  ): Promise<Readonly<{ ahead: number; behind: number }> | null> {
    if (directory === null || beforeOid === null || afterOid === null) {
      return null;
    }
    const output = await this.#captureOptional(
      directory,
      ["rev-list", "--left-right", "--count", `${beforeOid}...${afterOid}`],
      signal,
    );
    const fields = output?.trim().split(/\s+/u) ?? [];
    const behind = Number(fields[0]);
    const ahead = Number(fields[1]);
    return fields.length === 2 &&
      Number.isSafeInteger(ahead) &&
      ahead >= 0 &&
      Number.isSafeInteger(behind) &&
      behind >= 0
      ? Object.freeze({ ahead, behind })
      : null;
  }

  async #worktreeState(
    directory: DirectoryPin | null,
    signal?: AbortSignal,
  ): Promise<SubmoduleWorktreeState> {
    if (directory === null) {
      return Object.freeze({
        present: false,
        initialized: false,
        headOid: null,
        branch: null,
        detached: false,
        dirty: null,
      });
    }
    const headOutput = await this.#captureOptional(
      directory.path,
      ["rev-parse", "--verify", "HEAD"],
      signal,
    );
    const headOid = headOutput === null ? null : parseObjectId(headOutput);
    if (headOid === null) {
      return Object.freeze({
        present: true,
        initialized: false,
        headOid: null,
        branch: null,
        detached: false,
        dirty: null,
      });
    }
    const branchOutput = await this.#captureOptional(
      directory.path,
      ["symbolic-ref", "--quiet", "--short", "HEAD"],
      signal,
    );
    const branch = branchOutput?.trim() || null;
    const status = await this.#captureRequired(
      directory.path,
      ["status", "--porcelain=v2", "--untracked-files=normal", "--ignore-submodules=none"],
      signal,
    );
    return Object.freeze({
      present: true,
      initialized: true,
      headOid,
      branch,
      detached: branch === null,
      dirty: status.length > 0,
    });
  }

  async #nestedSubmodules(
    directory: DirectoryPin | null,
    initialized: boolean,
    signal?: AbortSignal,
  ): Promise<readonly NestedSubmoduleMetadata[]> {
    if (directory === null || !initialized) return Object.freeze([]);
    const output = await this.#captureRequired(
      directory.path,
      ["-c", "core.quotePath=false", "submodule", "status", "--recursive"],
      signal,
    );
    const entries = parseNestedSubmoduleStatus(output);
    const metadata: NestedSubmoduleMetadata[] = [];
    for (const entry of entries) {
      let dirty: boolean | null = null;
      if (entry.initialized) {
        const nestedDirectory = await this.#resolveSubmoduleDirectory(directory.path, entry.path);
        if (nestedDirectory === null) {
          throw invalidInput("Nested submodule changed while metadata was loaded");
        }
        const status = await this.#captureRequired(
          nestedDirectory.path,
          ["status", "--porcelain=v2", "--untracked-files=normal", "--ignore-submodules=none"],
          signal,
        );
        dirty = status.length > 0;
        await this.#verifyDirectoryPin(join(directory.path, entry.path), nestedDirectory);
      }
      metadata.push(Object.freeze({ ...entry, dirty }));
    }
    return Object.freeze(metadata);
  }

  async #resolveSubmoduleDirectory(root: string, path: string): Promise<DirectoryPin | null> {
    let canonical: string;
    try {
      canonical = await realpath(join(root, path));
    } catch (error) {
      if (isMissingPathError(error)) return null;
      throw invalidInput("Submodule path could not be resolved safely");
    }
    if (!isInside(root, canonical)) {
      throw invalidInput("Submodule path resolves outside the repository");
    }
    const metadata = await stat(canonical);
    return metadata.isDirectory()
      ? Object.freeze({ path: canonical, identity: identity(metadata) })
      : null;
  }

  async #pinDirectory(path: string, requireChild: boolean): Promise<DirectoryPin> {
    try {
      const canonical = await realpath(path);
      if (requireChild && canonical === path) {
        throw invalidInput("Submodule path is not below its repository");
      }
      const metadata = await stat(canonical);
      if (!metadata.isDirectory()) {
        throw invalidInput("Repository root is no longer a directory");
      }
      return Object.freeze({
        path: canonical,
        identity: identity(metadata),
      });
    } catch (error) {
      if (error instanceof GitUtilityError) throw error;
      throw invalidInput("Repository root could not be resolved safely");
    }
  }

  async #verifyDirectoryPin(inputPath: string, pin: DirectoryPin): Promise<void> {
    try {
      const canonical = await realpath(inputPath);
      const metadata = await stat(canonical);
      if (
        canonical !== pin.path ||
        !metadata.isDirectory() ||
        !isSameIdentity(metadata, pin.identity)
      ) {
        throw invalidInput("Repository path changed while submodule metadata was loaded");
      }
    } catch (error) {
      if (error instanceof GitUtilityError) throw error;
      throw invalidInput("Repository path changed while submodule metadata was loaded");
    }
  }

  async #captureRequired(
    cwd: string,
    args: readonly string[],
    signal?: AbortSignal,
  ): Promise<string> {
    const outcome = await this.#run(cwd, args, signal);
    if (outcome.kind === "completed") return outputText(outcome);
    if (outcome.kind === "cancelled") {
      throw new GitUtilityError("commandFailed", `Git command was cancelled (${outcome.reason})`);
    }
    throw new GitUtilityError(outcome.code, outcome.message, outcome.exitCode);
  }

  async #captureOptional(
    cwd: string,
    args: readonly string[],
    signal?: AbortSignal,
  ): Promise<string | null> {
    const outcome = await this.#run(cwd, args, signal);
    if (outcome.kind === "completed") return outputText(outcome);
    if (outcome.kind === "failed" && outcome.code === "commandFailed") {
      return null;
    }
    if (outcome.kind === "cancelled") {
      throw new GitUtilityError("commandFailed", `Git command was cancelled (${outcome.reason})`);
    }
    throw new GitUtilityError(outcome.code, outcome.message, outcome.exitCode);
  }

  #run(cwd: string, args: readonly string[], signal?: AbortSignal): Promise<GitProcessOutcome> {
    return this.#runner.run(
      {
        cwd,
        args,
        redactStdout: false,
        outputLimitBytes: SUBMODULE_OUTPUT_LIMIT_BYTES,
      },
      signal,
    );
  }
}
