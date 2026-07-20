import { isUtf8 } from "node:buffer";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, chmod, lstat, open, readFile, realpath, rename, rm, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import type { RepositoryId } from "../../../src/shared/contracts/git-utility";
import type { ConflictContent, ConflictFile } from "../../../src/shared/contracts/model";
import { GitUtilityError } from "./git-error";
import { safeErrorMessage } from "./redaction";
import type { RepositoryRegistry } from "./repository-registry";
import { validateRelativePath } from "./validation";

export const MAX_CONFLICT_TEXT_BYTES = 5 * 1024 * 1024;
export const MAX_CONFLICT_TEXT_LINES = 50_000;

const MAX_GIT_OUTPUT_BYTES = 16 * 1024 * 1024;
const GIT_TIMEOUT_MS = 120_000;
const GIT_ENVIRONMENT = Object.freeze({
  GIT_TERMINAL_PROMPT: "0",
  GIT_OPTIONAL_LOCKS: "0",
  GIT_PAGER: "cat",
  LC_ALL: "C",
});

interface GitResult {
  readonly exitCode: number;
  readonly stdout: Buffer;
  readonly stderr: Buffer;
}

interface ConflictGit {
  run(cwd: string, args: readonly string[], signal?: AbortSignal): Promise<GitResult>;
}

interface ConflictBuilder {
  baseOid: string | null;
  localOid: string | null;
  remoteOid: string | null;
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

class SpawnConflictGit implements ConflictGit {
  run(cwd: string, args: readonly string[], signal?: AbortSignal): Promise<GitResult> {
    return new Promise((resolve, reject) => {
      if (isAborted(signal)) {
        reject(new GitUtilityError("commandFailed", "Git conflict command was cancelled"));
        return;
      }
      const child = spawn("git", [...args], {
        cwd,
        env: { ...process.env, ...GIT_ENVIRONMENT },
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let outputBytes = 0;
      let settled = false;
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        finish(() =>
          reject(new GitUtilityError("commandFailed", "Git conflict command timed out")),
        );
      }, GIT_TIMEOUT_MS);
      timeout.unref();

      const onAbort = (): void => {
        child.kill("SIGKILL");
        finish(() =>
          reject(new GitUtilityError("commandFailed", "Git conflict command was cancelled")),
        );
      };

      const finish = (settle: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        signal?.removeEventListener("abort", onAbort);
        settle();
      };
      const append = (target: Buffer[], value: Buffer): void => {
        outputBytes += value.byteLength;
        if (outputBytes > MAX_GIT_OUTPUT_BYTES) {
          child.kill("SIGKILL");
          finish(() =>
            reject(new GitUtilityError("outputLimit", "Git conflict output exceeded 16 MiB")),
          );
          return;
        }
        target.push(Buffer.from(value));
      };
      child.stdout.on("data", (value: Buffer) => append(stdout, value));
      child.stderr.on("data", (value: Buffer) => append(stderr, value));
      child.once("error", (error) => {
        finish(() =>
          reject(new GitUtilityError("gitUnavailable", safeErrorMessage(error.message))),
        );
      });
      child.once("close", (exitCode) => {
        finish(() =>
          resolve({
            exitCode: exitCode ?? -1,
            stdout: Buffer.concat(stdout),
            stderr: Buffer.concat(stderr),
          }),
        );
      });
      signal?.addEventListener("abort", onAbort, { once: true });
      if (isAborted(signal)) onAbort();
    });
  }
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted !== true) return;
  throw new GitUtilityError("commandFailed", "Conflict operation was cancelled");
}

function hasMoreThanLines(content: string, maximum: number): boolean {
  if (content.length === 0) return false;
  let lines = content.endsWith("\n") ? 0 : 1;
  for (let index = content.indexOf("\n"); index >= 0; index = content.indexOf("\n", index + 1)) {
    lines += 1;
    if (lines > maximum) return true;
  }
  return false;
}

function textFromBytes(bytes: Buffer): string | null {
  if (bytes.byteLength > MAX_CONFLICT_TEXT_BYTES || bytes.includes(0) || !isUtf8(bytes)) {
    return null;
  }
  const content = bytes.toString("utf8");
  return hasMoreThanLines(content, MAX_CONFLICT_TEXT_LINES) ? null : content;
}

function validateTextContent(content: string): void {
  if (
    Buffer.byteLength(content, "utf8") > MAX_CONFLICT_TEXT_BYTES ||
    hasMoreThanLines(content, MAX_CONFLICT_TEXT_LINES) ||
    content.includes("\0")
  ) {
    throw new GitUtilityError(
      "invalidInput",
      "Conflict result must be UTF-8 text no larger than 5 MiB or 50,000 lines",
    );
  }
}

function gitFailure(args: readonly string[], result: GitResult): GitUtilityError {
  const detail = safeErrorMessage(result.stderr.toString("utf8").trim());
  return new GitUtilityError(
    "commandFailed",
    detail || `git ${args[0] ?? "command"} failed`,
    result.exitCode,
  );
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function isMissing(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  return error.code === "ENOENT" || error.code === "ENOTDIR";
}

export class GitConflictService {
  readonly #registry: RepositoryRegistry;
  readonly #git: ConflictGit;

  private constructor(registry: RepositoryRegistry, git: ConflictGit) {
    this.#registry = registry;
    this.#git = git;
  }

  static of(registry: RepositoryRegistry): GitConflictService {
    return new GitConflictService(registry, new SpawnConflictGit());
  }

  async list(repositoryId: RepositoryId, signal?: AbortSignal): Promise<readonly ConflictFile[]> {
    assertNotAborted(signal);
    const repository = this.#registry.get(repositoryId);
    const result = await this.#git.run(repository.path, ["ls-files", "--unmerged", "-z"], signal);
    if (result.exitCode !== 0) throw gitFailure(["ls-files"], result);
    const conflicts = this.#parseUnmerged(result.stdout);
    const files: ConflictFile[] = [];
    for (const [path, conflict] of [...conflicts.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      assertNotAborted(signal);
      const binary = await this.#isBinary(
        repository.path,
        [conflict.baseOid, conflict.localOid, conflict.remoteOid],
        signal,
      );
      files.push({ path, ...conflict, binary });
    }
    return files;
  }

  async read(
    repositoryId: RepositoryId,
    path: string,
    signal?: AbortSignal,
  ): Promise<ConflictContent> {
    assertNotAborted(signal);
    validateRelativePath(path);
    const repository = this.#registry.get(repositoryId);
    const conflict = (await this.list(repositoryId, signal)).find((entry) => entry.path === path);
    if (conflict === undefined) {
      throw new GitUtilityError("invalidInput", "Path is not conflicted");
    }
    const [base, local, remote, result, labels] = await Promise.all([
      this.#readStage(repository.path, path, 1, signal),
      this.#readStage(repository.path, path, 2, signal),
      this.#readStage(repository.path, path, 3, signal),
      this.#readResult(repository.path, path, signal),
      this.#labels(repository.gitDirectory),
    ]);
    return {
      path,
      base,
      local,
      remote,
      result,
      binary: conflict.binary || [base, local, remote, result].some((content) => content === null),
      localLabel: labels.local,
      remoteLabel: labels.remote,
    };
  }

  async write(
    repositoryId: RepositoryId,
    path: string,
    result: string,
    stage: boolean,
    signal?: AbortSignal,
  ): Promise<void> {
    assertNotAborted(signal);
    validateRelativePath(path);
    validateTextContent(result);
    const repository = this.#registry.get(repositoryId);
    const destination = await this.#checkedWorktreePath(repository.path, path);
    assertNotAborted(signal);
    const temporary = join(dirname(destination), `.git-client-conflict-${randomUUID()}.tmp`);
    try {
      const handle = await open(temporary, "wx");
      try {
        await handle.writeFile(result, "utf8");
        await handle.sync();
      } finally {
        await handle.close();
      }
      try {
        const metadata = await stat(destination);
        await chmod(temporary, metadata.mode);
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
      assertNotAborted(signal);
      await rename(temporary, destination);
    } catch (error) {
      await rm(temporary, { force: true });
      throw error;
    }
    if (stage) await this.#run(repository.path, ["add", "--", path], signal);
  }

  async resolveBinary(
    repositoryId: RepositoryId,
    path: string,
    side: "ours" | "theirs",
    signal?: AbortSignal,
  ): Promise<void> {
    assertNotAborted(signal);
    validateRelativePath(path);
    const repository = this.#registry.get(repositoryId);
    await this.#run(repository.path, ["checkout", `--${side}`, "--", path], signal);
    await this.#run(repository.path, ["add", "--", path], signal);
  }

  #parseUnmerged(output: Buffer): ReadonlyMap<string, ConflictBuilder> {
    const conflicts = new Map<string, ConflictBuilder>();
    let offset = 0;
    while (offset < output.byteLength) {
      const terminator = output.indexOf(0, offset);
      const end = terminator < 0 ? output.byteLength : terminator;
      const record = output.subarray(offset, end);
      offset = end + 1;
      if (record.byteLength === 0) continue;
      const separator = record.indexOf(0x09);
      if (separator < 0)
        throw new GitUtilityError("commandFailed", "Invalid unmerged index record");
      const metadata = record.subarray(0, separator).toString("ascii").trim().split(/\s+/u);
      const pathBytes = record.subarray(separator + 1);
      if (!isUtf8(pathBytes)) {
        throw new GitUtilityError("commandFailed", "Non-UTF-8 conflict paths are unsupported");
      }
      const path = pathBytes.toString("utf8");
      validateRelativePath(path);
      const oid = metadata[1];
      const stage = Number(metadata[2]);
      if (oid === undefined || !/^[0-9a-f]+$/u.test(oid)) {
        throw new GitUtilityError("commandFailed", "Missing conflict object ID");
      }
      if (stage !== 1 && stage !== 2 && stage !== 3) {
        throw new GitUtilityError("commandFailed", "Invalid conflict stage");
      }
      const entry = conflicts.get(path) ?? {
        baseOid: null,
        localOid: null,
        remoteOid: null,
      };
      if (stage === 1) entry.baseOid = oid;
      else if (stage === 2) entry.localOid = oid;
      else entry.remoteOid = oid;
      conflicts.set(path, entry);
    }
    return conflicts;
  }

  async #isBinary(
    root: string,
    oids: readonly (string | null)[],
    signal: AbortSignal | undefined,
  ): Promise<boolean> {
    for (const oid of oids) {
      assertNotAborted(signal);
      if (oid === null) continue;
      if ((await this.#readBlobText(root, oid, false, signal)) === null) return true;
    }
    return false;
  }

  async #readStage(
    root: string,
    path: string,
    stage: 1 | 2 | 3,
    signal: AbortSignal | undefined,
  ): Promise<string | null> {
    return this.#readBlobText(root, `:${stage}:${path}`, true, signal);
  }

  async #readBlobText(
    root: string,
    object: string,
    missingAsNull: boolean,
    signal: AbortSignal | undefined,
  ): Promise<string | null> {
    const sizeArguments = ["cat-file", "-s", object] as const;
    const sizeResult = await this.#git.run(root, sizeArguments, signal);
    if (sizeResult.exitCode !== 0) {
      if (missingAsNull) return null;
      throw gitFailure(sizeArguments, sizeResult);
    }
    const size = sizeResult.stdout.toString("ascii").trim();
    if (!/^\d+$/u.test(size)) {
      throw new GitUtilityError("commandFailed", "Git returned an invalid conflict blob size");
    }
    if (BigInt(size) > BigInt(MAX_CONFLICT_TEXT_BYTES)) return null;

    const blobArguments = ["cat-file", "blob", object] as const;
    const blobResult = await this.#git.run(root, blobArguments, signal);
    if (blobResult.exitCode !== 0) {
      if (missingAsNull) return null;
      throw gitFailure(blobArguments, blobResult);
    }
    return textFromBytes(blobResult.stdout);
  }

  async #readResult(
    root: string,
    path: string,
    signal: AbortSignal | undefined,
  ): Promise<string | null> {
    assertNotAborted(signal);
    const destination = await this.#checkedWorktreePath(root, path);
    try {
      if ((await stat(destination)).size > MAX_CONFLICT_TEXT_BYTES) return null;
      return textFromBytes(await readFile(destination));
    } catch (error) {
      if (isMissing(error)) return "";
      throw error;
    }
  }

  async #checkedWorktreePath(root: string, path: string): Promise<string> {
    const destination = join(root, path);
    try {
      if ((await lstat(destination)).isSymbolicLink()) {
        throw new GitUtilityError("invalidInput", "Symbolic-link conflict results are unsupported");
      }
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    const [canonicalParent, canonicalRoot] = await Promise.all([
      realpath(dirname(destination)),
      realpath(root),
    ]);
    const relativeParent = relative(canonicalRoot, canonicalParent);
    if (
      relativeParent === ".." ||
      relativeParent.startsWith(`..${sep}`) ||
      isAbsolute(relativeParent)
    ) {
      throw new GitUtilityError("invalidInput", "Path resolves outside the repository");
    }
    return destination;
  }

  async #labels(gitDirectory: string): Promise<{
    readonly local: string;
    readonly remote: string;
  }> {
    if (
      (await exists(join(gitDirectory, "rebase-merge"))) ||
      (await exists(join(gitDirectory, "rebase-apply")))
    ) {
      return {
        local: "Rebased onto (ours)",
        remote: "Commit being rebased (theirs)",
      };
    }
    if (await exists(join(gitDirectory, "CHERRY_PICK_HEAD"))) {
      return {
        local: "Current branch (ours)",
        remote: "Cherry-picked commit (theirs)",
      };
    }
    if (await exists(join(gitDirectory, "REVERT_HEAD"))) {
      return {
        local: "Current branch (ours)",
        remote: "Reverted commit (theirs)",
      };
    }
    return { local: "Local (ours)", remote: "Remote (theirs)" };
  }

  async #run(
    root: string,
    args: readonly string[],
    signal: AbortSignal | undefined,
  ): Promise<void> {
    const result = await this.#git.run(root, args, signal);
    if (result.exitCode !== 0) throw gitFailure(args, result);
  }
}
