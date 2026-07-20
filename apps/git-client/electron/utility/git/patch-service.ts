import { Buffer, isUtf8 } from "node:buffer";
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import type { Stats } from "node:fs";
import { chmod, lstat, open, realpath, rename, rm } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import type {
  GitFailureCode,
  RepositoryId,
  RepositoryRecord,
} from "../../../src/shared/contracts/git-utility";
import type { PatchExportResult } from "../../../src/shared/contracts/model";
import { GitUtilityError } from "./git-error";
import { redactCredentials, safeErrorMessage } from "./redaction";
import { validateRevision } from "./validation";

export const MAX_PATCH_REVISIONS = 500;
export const MAX_CLIPBOARD_PATCH_BYTES = 10 * 1024 * 1024;
export const MAX_EXPORTED_PATCH_BYTES = 20 * 1024 * 1024;
export const MAX_IMPORTED_PATCH_BYTES = 20 * 1024 * 1024;
export const PATCH_COMMAND_TIMEOUT_MS = 120_000;

const MAX_PATCH_DIAGNOSTIC_BYTES = 1024 * 1024;
const PROCESS_ENVIRONMENT = Object.freeze({
  GIT_TERMINAL_PROMPT: "0",
  GIT_PAGER: "cat",
  GIT_OPTIONAL_LOCKS: "0",
  LC_ALL: "C",
});

export type PatchCancellationReason = "requested" | "repositoryClosed" | "timeout";

export interface PatchProcessSpec {
  readonly cwd: string;
  readonly args: readonly string[];
  readonly stdin?: Buffer;
  readonly timeoutMs: number;
  readonly stdoutLimitBytes: number;
  readonly stderrLimitBytes: number;
}

interface PatchProcessOutcomeBase {
  readonly stdout: Buffer;
  readonly stderr: Buffer;
  readonly durationMs: number;
}

export interface PatchProcessCompleted extends PatchProcessOutcomeBase {
  readonly kind: "completed";
  readonly exitCode: number;
}

export interface PatchProcessFailed extends PatchProcessOutcomeBase {
  readonly kind: "failed";
  readonly code: GitFailureCode;
  readonly message: string;
  readonly exitCode: number | null;
}

export interface PatchProcessCancelled extends PatchProcessOutcomeBase {
  readonly kind: "cancelled";
  readonly reason: PatchCancellationReason;
}

export type PatchProcessOutcome =
  | PatchProcessCompleted
  | PatchProcessFailed
  | PatchProcessCancelled;

export interface PatchProcessRunnerLike {
  run(spec: PatchProcessSpec, signal?: AbortSignal): Promise<PatchProcessOutcome>;
}

export interface PatchRepositoryRegistryLike {
  get(repositoryId: RepositoryId): RepositoryRecord;
}

function elapsed(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function signalCancellationReason(signal: AbortSignal): PatchCancellationReason {
  return signal.reason === "repositoryClosed" ? "repositoryClosed" : "requested";
}

function joined(chunks: readonly Buffer[]): Buffer {
  return chunks.length === 0 ? Buffer.alloc(0) : Buffer.concat(chunks);
}

function redactedStderr(chunks: readonly Buffer[]): Buffer {
  return Buffer.from(redactCredentials(joined(chunks).toString("utf8")), "utf8");
}

export class PatchProcessRunner implements PatchProcessRunnerLike {
  readonly #gitBinary: string;

  constructor(gitBinary = "git") {
    this.#gitBinary = gitBinary;
  }

  run(spec: PatchProcessSpec, signal?: AbortSignal): Promise<PatchProcessOutcome> {
    const startedAt = performance.now();
    if (
      !Number.isSafeInteger(spec.timeoutMs) ||
      spec.timeoutMs <= 0 ||
      !Number.isSafeInteger(spec.stdoutLimitBytes) ||
      spec.stdoutLimitBytes <= 0 ||
      !Number.isSafeInteger(spec.stderrLimitBytes) ||
      spec.stderrLimitBytes <= 0
    ) {
      return Promise.resolve({
        kind: "failed",
        code: "invalidInput",
        message: "Patch process limits must be positive integers",
        exitCode: null,
        stdout: Buffer.alloc(0),
        stderr: Buffer.alloc(0),
        durationMs: elapsed(startedAt),
      });
    }
    if (signal?.aborted === true) {
      return Promise.resolve({
        kind: "cancelled",
        reason: signalCancellationReason(signal),
        stdout: Buffer.alloc(0),
        stderr: Buffer.alloc(0),
        durationMs: elapsed(startedAt),
      });
    }

    return new Promise((resolve) => {
      let child: ChildProcessWithoutNullStreams;
      try {
        child = spawn(this.#gitBinary, [...spec.args], {
          cwd: spec.cwd,
          env: { ...process.env, ...PROCESS_ENVIRONMENT },
          shell: false,
          stdio: ["pipe", "pipe", "pipe"],
          windowsHide: true,
        });
      } catch (error) {
        resolve({
          kind: "failed",
          code: "gitUnavailable",
          message: error instanceof Error ? error.message : "Unable to start Git",
          exitCode: null,
          stdout: Buffer.alloc(0),
          stderr: Buffer.alloc(0),
          durationMs: elapsed(startedAt),
        });
        return;
      }

      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let stopReason: PatchCancellationReason | "outputLimit" | null = null;
      let settled = false;
      let forceKillTimer: ReturnType<typeof setTimeout> | null = null;

      const stop = (reason: PatchCancellationReason | "outputLimit"): void => {
        if (stopReason !== null) return;
        stopReason = reason;
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGTERM");
          forceKillTimer = setTimeout(() => {
            if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
          }, 2_000);
          forceKillTimer.unref();
        }
      };
      const append = (
        target: Buffer[],
        value: Buffer,
        currentBytes: number,
        limitBytes: number,
      ): number => {
        const available = Math.max(0, limitBytes - currentBytes);
        const retained = value.byteLength <= available ? value : value.subarray(0, available);
        if (retained.byteLength > 0) target.push(Buffer.from(retained));
        if (retained.byteLength < value.byteLength) stop("outputLimit");
        return currentBytes + retained.byteLength;
      };
      const cleanUp = (): void => {
        clearTimeout(timeout);
        if (forceKillTimer !== null) clearTimeout(forceKillTimer);
        signal?.removeEventListener("abort", onAbort);
      };
      const finish = (outcome: PatchProcessOutcome): void => {
        if (settled) return;
        settled = true;
        cleanUp();
        resolve(outcome);
      };
      const onAbort = (): void => {
        stop(signal === undefined ? "requested" : signalCancellationReason(signal));
      };
      const timeout = setTimeout(() => stop("timeout"), spec.timeoutMs);
      timeout.unref();
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted === true) onAbort();

      child.stdin.on("error", () => {
        // Git may reject the patch before consuming stdin; close owns the terminal result.
      });
      if (spec.stdin === undefined) child.stdin.end();
      else child.stdin.end(spec.stdin);
      child.stdout.on("data", (value: Buffer) => {
        stdoutBytes = append(stdout, value, stdoutBytes, spec.stdoutLimitBytes);
      });
      child.stderr.on("data", (value: Buffer) => {
        stderrBytes = append(stderr, value, stderrBytes, spec.stderrLimitBytes);
      });
      child.once("error", (error) => {
        finish({
          kind: "failed",
          code: "gitUnavailable",
          message: error.message,
          exitCode: null,
          stdout: joined(stdout),
          stderr: redactedStderr(stderr),
          durationMs: elapsed(startedAt),
        });
      });
      child.once("close", (exitCode) => {
        const capturedStdout = joined(stdout);
        const capturedStderr = redactedStderr(stderr);
        if (stopReason === "outputLimit") {
          finish({
            kind: "failed",
            code: "outputLimit",
            message: "Git patch output exceeded its configured limit",
            exitCode,
            stdout: capturedStdout,
            stderr: capturedStderr,
            durationMs: elapsed(startedAt),
          });
          return;
        }
        if (stopReason !== null) {
          finish({
            kind: "cancelled",
            reason: stopReason,
            stdout: capturedStdout,
            stderr: capturedStderr,
            durationMs: elapsed(startedAt),
          });
          return;
        }
        if (exitCode === 0) {
          finish({
            kind: "completed",
            exitCode,
            stdout: capturedStdout,
            stderr: capturedStderr,
            durationMs: elapsed(startedAt),
          });
          return;
        }
        finish({
          kind: "failed",
          code: "commandFailed",
          message: capturedStderr.toString("utf8") || `Git exited with status ${exitCode ?? -1}`,
          exitCode,
          stdout: capturedStdout,
          stderr: capturedStderr,
          durationMs: elapsed(startedAt),
        });
      });
    });
  }
}

interface FileIdentity {
  readonly device: number;
  readonly inode: number;
}

interface ExistingDestination extends FileIdentity {
  readonly kind: "file";
  readonly mode: number;
}

interface MissingDestination {
  readonly kind: "missing";
}

type DestinationState = ExistingDestination | MissingDestination;

interface SelectedParent {
  readonly selectedTarget: string;
  readonly selectedParent: string;
  readonly selectedIdentity: FileIdentity;
  readonly canonicalParent: string;
  readonly canonicalIdentity: FileIdentity;
  readonly canonicalTarget: string;
}

interface AtomicTarget extends SelectedParent {
  readonly destination: DestinationState;
}

function identity(metadata: Stats): FileIdentity {
  return { device: metadata.dev, inode: metadata.ino };
}

function sameIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return left.device === right.device && left.inode === right.inode;
}

function isMissing(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  return error.code === "ENOENT" || error.code === "ENOTDIR";
}

function invalidPath(message: string): GitUtilityError {
  return new GitUtilityError("invalidInput", message);
}

function validatedSelectedPath(untrustedPath: unknown): string {
  if (
    typeof untrustedPath !== "string" ||
    untrustedPath.length === 0 ||
    untrustedPath.length > 16_384 ||
    untrustedPath.includes("\0") ||
    !isAbsolute(untrustedPath) ||
    basename(untrustedPath).length === 0
  ) {
    throw invalidPath("Patch path must be an absolute file path without null bytes");
  }
  return untrustedPath;
}

async function selectedParent(untrustedPath: unknown): Promise<SelectedParent> {
  const selectedPath = validatedSelectedPath(untrustedPath);
  const selectedParentPath = dirname(selectedPath);
  try {
    const selectedMetadata = await lstat(selectedParentPath);
    if (selectedMetadata.isSymbolicLink() || !selectedMetadata.isDirectory()) {
      throw invalidPath("Patch parent must be a real directory, not a symbolic link");
    }
    const canonicalParent = await realpath(selectedParentPath);
    const canonicalMetadata = await lstat(canonicalParent);
    if (canonicalMetadata.isSymbolicLink() || !canonicalMetadata.isDirectory()) {
      throw invalidPath("Canonical patch parent must remain a real directory");
    }
    return {
      selectedTarget: selectedPath,
      selectedParent: selectedParentPath,
      selectedIdentity: identity(selectedMetadata),
      canonicalParent,
      canonicalIdentity: identity(canonicalMetadata),
      canonicalTarget: join(canonicalParent, basename(selectedPath)),
    };
  } catch (error) {
    if (error instanceof GitUtilityError) throw error;
    const detail = error instanceof Error ? error.message : "Patch parent is inaccessible";
    throw invalidPath(safeErrorMessage(detail));
  }
}

async function destinationState(path: string): Promise<DestinationState> {
  try {
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink()) throw invalidPath("Patch target must not be a symbolic link");
    if (!metadata.isFile()) throw invalidPath("Patch target must be a regular file");
    return { kind: "file", ...identity(metadata), mode: metadata.mode };
  } catch (error) {
    if (isMissing(error)) return { kind: "missing" };
    throw error;
  }
}

async function assertStableParent(parent: SelectedParent): Promise<void> {
  try {
    const [selectedMetadata, canonicalMetadata, canonicalAgain] = await Promise.all([
      lstat(parent.selectedParent),
      lstat(parent.canonicalParent),
      realpath(parent.selectedParent),
    ]);
    if (
      selectedMetadata.isSymbolicLink() ||
      !selectedMetadata.isDirectory() ||
      canonicalMetadata.isSymbolicLink() ||
      !canonicalMetadata.isDirectory() ||
      canonicalAgain !== parent.canonicalParent ||
      !sameIdentity(identity(selectedMetadata), parent.selectedIdentity) ||
      !sameIdentity(identity(canonicalMetadata), parent.canonicalIdentity)
    ) {
      throw invalidPath("Patch parent changed during the operation");
    }
  } catch (error) {
    if (error instanceof GitUtilityError) throw error;
    throw invalidPath("Patch parent changed during the operation");
  }
}

function sameDestination(left: DestinationState, right: DestinationState): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "missing") return true;
  return right.kind === "file" && sameIdentity(left, right);
}

async function prepareAtomicTarget(untrustedPath: unknown): Promise<AtomicTarget> {
  const parent = await selectedParent(untrustedPath);
  return { ...parent, destination: await destinationState(parent.canonicalTarget) };
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted !== true) return;
  const reason = signalCancellationReason(signal);
  throw new GitUtilityError(
    "commandFailed",
    reason === "repositoryClosed"
      ? "Patch command cancelled because the repository closed"
      : "Patch command cancelled",
  );
}

async function atomicWritePatch(
  target: AtomicTarget,
  content: Buffer,
  signal: AbortSignal | undefined,
): Promise<string> {
  assertNotAborted(signal);
  await assertStableParent(target);
  if (!sameDestination(target.destination, await destinationState(target.canonicalTarget))) {
    throw invalidPath("Patch target changed during the operation");
  }
  const temporaryPath = join(target.canonicalParent, `.git-client-patch-${randomUUID()}.tmp`);
  try {
    const temporaryIdentity = await (async (): Promise<FileIdentity> => {
      const handle = await open(
        temporaryPath,
        constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
        0o600,
      );
      try {
        await handle.writeFile(content);
        await handle.sync();
        return identity(await handle.stat());
      } finally {
        await handle.close();
      }
    })();
    if (target.destination.kind === "file") {
      await chmod(temporaryPath, target.destination.mode & 0o777);
    }
    assertNotAborted(signal);
    await assertStableParent(target);
    if (!sameDestination(target.destination, await destinationState(target.canonicalTarget))) {
      throw invalidPath("Patch target changed during the operation");
    }
    await rename(temporaryPath, target.canonicalTarget);
    const committed = await destinationState(target.canonicalTarget);
    if (committed.kind !== "file" || !sameIdentity(temporaryIdentity, committed)) {
      throw invalidPath("Patch target changed while it was being committed");
    }
    await assertStableParent(target);
    return target.selectedTarget;
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    if (error instanceof GitUtilityError) throw error;
    const detail = error instanceof Error ? error.message : "Unable to write patch file";
    throw new GitUtilityError("spawnFailed", safeErrorMessage(detail));
  }
}

async function readSelectedPatch(
  untrustedPath: unknown,
  signal: AbortSignal | undefined,
): Promise<Buffer> {
  assertNotAborted(signal);
  const parent = await selectedParent(untrustedPath);
  const initial = await destinationState(parent.canonicalTarget);
  if (initial.kind !== "file") throw invalidPath("Selected patch must be a regular file");
  await assertStableParent(parent);
  try {
    const handle = await open(parent.canonicalTarget, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const metadata = await handle.stat();
      if (!metadata.isFile() || !sameIdentity(initial, identity(metadata))) {
        throw invalidPath("Selected patch changed before it could be opened");
      }
      await assertStableParent(parent);
      const chunks: Buffer[] = [];
      let totalBytes = 0;
      let position = 0;
      while (true) {
        assertNotAborted(signal);
        const remaining = MAX_IMPORTED_PATCH_BYTES + 1 - totalBytes;
        const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, remaining));
        const { bytesRead } = await handle.read(chunk, 0, chunk.byteLength, position);
        if (bytesRead === 0) break;
        chunks.push(Buffer.from(chunk.subarray(0, bytesRead)));
        totalBytes += bytesRead;
        position += bytesRead;
        if (totalBytes > MAX_IMPORTED_PATCH_BYTES) {
          throw invalidPath("Imported patch must not exceed 20 MiB");
        }
      }
      return joined(chunks);
    } finally {
      await handle.close().catch(() => undefined);
    }
  } catch (error) {
    if (error instanceof GitUtilityError) throw error;
    const detail = error instanceof Error ? error.message : "Unable to read selected patch";
    throw invalidPath(safeErrorMessage(detail));
  }
}

function validatedRevisions(untrustedRevisions: unknown): readonly string[] {
  if (
    !Array.isArray(untrustedRevisions) ||
    untrustedRevisions.length < 1 ||
    untrustedRevisions.length > MAX_PATCH_REVISIONS
  ) {
    throw new GitUtilityError("invalidInput", "Patch revisions must contain 1 to 500 entries");
  }
  const revisions: string[] = [];
  for (const revision of untrustedRevisions) {
    if (typeof revision !== "string") {
      throw new GitUtilityError("invalidInput", "Every patch revision must be a string");
    }
    validateRevision(revision);
    revisions.push(revision);
  }
  return Object.freeze(revisions);
}

function processFailure(
  outcome: Exclude<PatchProcessOutcome, PatchProcessCompleted>,
): GitUtilityError {
  if (outcome.kind === "cancelled") {
    const message =
      outcome.reason === "timeout"
        ? "Patch command timed out"
        : outcome.reason === "repositoryClosed"
          ? "Patch command cancelled because the repository closed"
          : "Patch command cancelled";
    return new GitUtilityError("commandFailed", message);
  }
  const detail = outcome.stderr.byteLength > 0 ? outcome.stderr.toString("utf8") : outcome.message;
  return new GitUtilityError(outcome.code, safeErrorMessage(detail), outcome.exitCode);
}

export class PatchService {
  readonly #registry: PatchRepositoryRegistryLike;
  readonly #runner: PatchProcessRunnerLike;

  constructor(
    registry: PatchRepositoryRegistryLike,
    runner: PatchProcessRunnerLike = new PatchProcessRunner(),
  ) {
    this.#registry = registry;
    this.#runner = runner;
  }

  async createPatchText(
    repositoryId: RepositoryId,
    untrustedRevisions: unknown,
    signal?: AbortSignal,
  ): Promise<string> {
    const revisions = validatedRevisions(untrustedRevisions);
    const repository = this.#registry.get(repositoryId);
    const patch = await this.#formatPatch(
      repository.path,
      revisions,
      MAX_CLIPBOARD_PATCH_BYTES,
      signal,
    );
    if (!isUtf8(patch)) {
      throw new GitUtilityError("invalidInput", "Clipboard patch is not valid UTF-8 text");
    }
    return patch.toString("utf8");
  }

  async exportPatch(
    repositoryId: RepositoryId,
    untrustedRevisions: unknown,
    untrustedTargetPath: unknown,
    signal?: AbortSignal,
  ): Promise<PatchExportResult> {
    const revisions = validatedRevisions(untrustedRevisions);
    const repository = this.#registry.get(repositoryId);
    const target = await prepareAtomicTarget(untrustedTargetPath);
    const patch = await this.#formatPatch(
      repository.path,
      revisions,
      MAX_EXPORTED_PATCH_BYTES,
      signal,
    );
    const path = await atomicWritePatch(target, patch, signal);
    return { path, sizeBytes: patch.byteLength, commitCount: revisions.length };
  }

  async importPatch(
    repositoryId: RepositoryId,
    untrustedPath: unknown,
    signal?: AbortSignal,
  ): Promise<void> {
    const repository = this.#registry.get(repositoryId);
    const patch = await readSelectedPatch(untrustedPath, signal);
    const outcome = await this.#runner.run(
      {
        cwd: repository.path,
        args: ["apply", "--index", "--3way", "-"],
        stdin: patch,
        timeoutMs: PATCH_COMMAND_TIMEOUT_MS,
        stdoutLimitBytes: MAX_PATCH_DIAGNOSTIC_BYTES,
        stderrLimitBytes: MAX_PATCH_DIAGNOSTIC_BYTES,
      },
      signal,
    );
    if (outcome.kind !== "completed") throw processFailure(outcome);
  }

  async #formatPatch(
    cwd: string,
    revisions: readonly string[],
    maximumBytes: number,
    signal: AbortSignal | undefined,
  ): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for (const revision of revisions) {
      assertNotAborted(signal);
      const outcome = await this.#runner.run(
        {
          cwd,
          args: ["format-patch", "--stdout", "--binary", "-1", "--end-of-options", revision],
          timeoutMs: PATCH_COMMAND_TIMEOUT_MS,
          stdoutLimitBytes: maximumBytes - totalBytes + 1,
          stderrLimitBytes: MAX_PATCH_DIAGNOSTIC_BYTES,
        },
        signal,
      );
      if (outcome.kind !== "completed") throw processFailure(outcome);
      totalBytes += outcome.stdout.byteLength;
      if (totalBytes > maximumBytes) {
        throw new GitUtilityError(
          "outputLimit",
          `Patch output must not exceed ${maximumBytes / (1024 * 1024)} MiB`,
        );
      }
      chunks.push(outcome.stdout);
    }
    return joined(chunks);
  }
}
