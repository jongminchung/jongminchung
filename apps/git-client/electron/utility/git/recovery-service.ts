import { Buffer, isUtf8 } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import type { Stats } from "node:fs";
import { lstat, mkdir, open, realpath, rename, rm } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { z } from "zod";
import {
  GitOperationSchema,
  type ValidatedGitOperation,
} from "../../../src/shared/contracts/git-operation";
import {
  RepositoryIdSchema,
  type RepositoryId,
  type RepositoryRecord,
} from "../../../src/shared/contracts/git-utility";
import type {
  RecoveryEntry,
  RecoveryRef,
  RecoveryRestoreResult,
} from "../../../src/shared/contracts/model";
import { GitUtilityError } from "./git-error";
import {
  GitProcessRunner,
  type GitProcessCompleted,
  type GitProcessOutcome,
  type GitProcessRunnerLike,
} from "./git-process";
import {
  captureRepositorySnapshot,
  copyRepositorySnapshot,
  repositorySnapshotsEqual,
  RepositorySnapshotSchema,
  restoreRepositorySnapshot,
  type RepositorySnapshot,
} from "./recovery-snapshot";
import { safeErrorMessage } from "./redaction";

export const MAX_RECOVERY_ENTRIES = 200;
export const MAX_RECOVERY_MANIFEST_BYTES = 96 * 1024 * 1024;

const MAX_RECOVERY_REFS = 32;
const MAX_RECOVERY_TEXT_CHARACTERS = 16_384;
const MAX_RECOVERY_DIAGNOSTIC_BYTES = 1024 * 1024;
const RECOVERY_DIRECTORY = "recovery";
const LEGACY_MANIFEST_VERSION = 1;
const MANIFEST_VERSION = 2;

const ObjectIdSchema = z.string().regex(/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u);
const ChecksumSchema = z.string().regex(/^[0-9a-f]{64}$/u);

function hasSafeRefStructure(value: string): boolean {
  if (
    value.length === 0 ||
    value.length > 16_384 ||
    value.includes("\0") ||
    value.includes("..") ||
    value.includes("@{") ||
    value.includes("//") ||
    value.endsWith(".") ||
    value.endsWith("/") ||
    value.endsWith(".lock") ||
    value.startsWith(".") ||
    value.startsWith("/")
  ) {
    return false;
  }
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 0x20 || codePoint === 0x7f || "~^:?*[\\".includes(character)) {
      return false;
    }
  }
  return true;
}

const RecoveryRefSchema = z
  .object({
    name: z.string().max(MAX_RECOVERY_TEXT_CHARACTERS).refine(hasSafeRefStructure),
    oid: ObjectIdSchema.nullable(),
  })
  .strict();
const RecoveryEntrySchema = z
  .object({
    id: z.uuid(),
    repositoryId: RepositoryIdSchema,
    operation: z
      .string()
      .min(1)
      .max(MAX_RECOVERY_TEXT_CHARACTERS)
      .refine((value) => !value.includes("\0")),
    createdAtMs: z.number().int().nonnegative().safe(),
    branch: z
      .string()
      .max(MAX_RECOVERY_TEXT_CHARACTERS)
      .refine((value) => !value.includes("\0"))
      .nullable(),
    headOid: ObjectIdSchema.nullable(),
    refs: z.array(RecoveryRefSchema).max(MAX_RECOVERY_REFS),
    recoverable: z.boolean(),
  })
  .strict()
  .superRefine((entry, context) => {
    const names = new Set<string>();
    for (const [index, reference] of entry.refs.entries()) {
      if (names.has(reference.name)) {
        context.addIssue({
          code: "custom",
          message: "Recovery entry contains duplicate refs",
          path: ["refs", index, "name"],
        });
      }
      names.add(reference.name);
    }
  });
const StoredRecoveryEntrySchema = RecoveryEntrySchema.safeExtend({
  snapshot: RepositorySnapshotSchema.nullable(),
});
const LegacyRecoveryManifestSchema = z
  .object({
    version: z.literal(LEGACY_MANIFEST_VERSION),
    entries: z.array(RecoveryEntrySchema).max(MAX_RECOVERY_ENTRIES),
    sha256: ChecksumSchema,
  })
  .strict();
const RecoveryManifestSchema = z
  .object({
    version: z.literal(MANIFEST_VERSION),
    entries: z.array(StoredRecoveryEntrySchema).max(MAX_RECOVERY_ENTRIES),
    sha256: ChecksumSchema,
  })
  .strict();

interface StoredRecoveryEntry extends RecoveryEntry {
  readonly snapshot: RepositorySnapshot | null;
}

interface RecoveryManifestPayload {
  readonly version: typeof MANIFEST_VERSION;
  readonly entries: readonly StoredRecoveryEntry[];
}

interface LegacyRecoveryManifestPayload {
  readonly version: typeof LEGACY_MANIFEST_VERSION;
  readonly entries: readonly RecoveryEntry[];
}

interface PinnedDirectory {
  readonly path: string;
  readonly device: number;
  readonly inode: number;
}

interface FileIdentity {
  readonly device: number;
  readonly inode: number;
  readonly size: number;
}

interface AffectedRefs {
  readonly operation: string;
  readonly names: readonly string[];
}

export interface RecoveryRepositoryRegistryLike {
  get(repositoryId: RepositoryId): RepositoryRecord;
}

function invalid(message: string): GitUtilityError {
  return new GitUtilityError("invalidInput", message);
}

function isErrno(error: unknown, code: string): boolean {
  return (
    error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === code
  );
}

function filesystemError(error: unknown, fallback: string): GitUtilityError {
  if (error instanceof GitUtilityError) return error;
  const detail = error instanceof Error ? error.message : fallback;
  return new GitUtilityError("commandFailed", safeErrorMessage(detail));
}

function sameDirectory(metadata: Stats, directory: PinnedDirectory): boolean {
  return metadata.dev === directory.device && metadata.ino === directory.inode;
}

function sameFile(metadata: Stats, file: FileIdentity): boolean {
  return metadata.dev === file.device && metadata.ino === file.inode && metadata.size === file.size;
}

function sameFileIdentity(left: FileIdentity, right: FileIdentity): boolean {
  return left.device === right.device && left.inode === right.inode && left.size === right.size;
}

function directoryFrom(path: string, metadata: Stats): PinnedDirectory {
  return { path, device: metadata.dev, inode: metadata.ino };
}

function fileFrom(metadata: Stats): FileIdentity {
  return { device: metadata.dev, inode: metadata.ino, size: metadata.size };
}

function checksum(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function manifestPayload(entries: readonly StoredRecoveryEntry[]): RecoveryManifestPayload {
  return { version: MANIFEST_VERSION, entries };
}

function legacyManifestPayload(entries: readonly RecoveryEntry[]): LegacyRecoveryManifestPayload {
  return { version: LEGACY_MANIFEST_VERSION, entries };
}

function payloadBytes(payload: RecoveryManifestPayload | LegacyRecoveryManifestPayload): Buffer {
  return Buffer.from(JSON.stringify(payload), "utf8");
}

function encodeManifest(entries: readonly StoredRecoveryEntry[]): Buffer {
  const payload = manifestPayload(entries);
  return Buffer.from(
    `${JSON.stringify({ ...payload, sha256: checksum(payloadBytes(payload)) }, null, 2)}\n`,
    "utf8",
  );
}

function validateRepositoryId(untrustedRepositoryId: unknown): RepositoryId {
  const result = RepositoryIdSchema.safeParse(untrustedRepositoryId);
  if (!result.success) throw invalid("Repository id must be a UUID");
  return result.data;
}

function validateEntryId(untrustedEntryId: unknown): string {
  const result = z.uuid().safeParse(untrustedEntryId);
  if (!result.success) throw invalid("Recovery entry id must be a UUID");
  return result.data;
}

function validateOperation(untrustedOperation: unknown): ValidatedGitOperation {
  const result = GitOperationSchema.safeParse(untrustedOperation);
  if (!result.success) throw invalid("Recovery operation is invalid");
  return result.data;
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted !== true) return;
  const suffix = signal.reason === "repositoryClosed" ? " because the repository closed" : "";
  throw new GitUtilityError("commandFailed", `Recovery operation was cancelled${suffix}`);
}

function outcomeText(outcome: GitProcessOutcome, stream: "stdout" | "stderr"): string {
  return outcome.output
    .filter((entry) => entry.stream === stream)
    .map((entry) => entry.data)
    .join("");
}

function processFailure(outcome: Exclude<GitProcessOutcome, GitProcessCompleted>): GitUtilityError {
  if (outcome.kind === "cancelled") {
    const suffix =
      outcome.reason === "timeout"
        ? " timed out"
        : outcome.reason === "repositoryClosed"
          ? " was cancelled because the repository closed"
          : " was cancelled";
    return new GitUtilityError("commandFailed", `Recovery Git command${suffix}`);
  }
  const detail = outcomeText(outcome, "stderr") || outcome.message;
  return new GitUtilityError(outcome.code, safeErrorMessage(detail), outcome.exitCode);
}

async function runGit(
  runner: GitProcessRunnerLike,
  repository: string,
  args: readonly string[],
  signal: AbortSignal | undefined,
  stdin?: string,
): Promise<GitProcessCompleted> {
  assertNotAborted(signal);
  const outcome = await runner.run(
    {
      cwd: repository,
      args,
      ...(stdin === undefined ? {} : { stdin }),
      redactStdout: false,
      outputLimitBytes: MAX_RECOVERY_DIAGNOSTIC_BYTES,
    },
    signal,
  );
  if (outcome.kind !== "completed") throw processFailure(outcome);
  return outcome;
}

async function captureOptional(
  runner: GitProcessRunnerLike,
  repository: string,
  args: readonly string[],
  missingExitCodes: readonly number[],
  signal: AbortSignal | undefined,
): Promise<string | null> {
  assertNotAborted(signal);
  const outcome = await runner.run(
    {
      cwd: repository,
      args,
      redactStdout: false,
      outputLimitBytes: MAX_RECOVERY_DIAGNOSTIC_BYTES,
    },
    signal,
  );
  if (outcome.kind === "completed") {
    const value = outcomeText(outcome, "stdout").trim();
    if (value.includes("\ufffd")) throw invalid("Non-UTF-8 Git ref names are unsupported");
    return value;
  }
  if (
    outcome.kind === "failed" &&
    outcome.code === "commandFailed" &&
    outcome.exitCode !== null &&
    missingExitCodes.includes(outcome.exitCode)
  ) {
    return null;
  }
  throw processFailure(outcome);
}

async function pinDirectory(path: string, label: string): Promise<PinnedDirectory> {
  let metadata: Stats;
  try {
    metadata = await lstat(path);
  } catch (error) {
    throw filesystemError(error, `${label} is not accessible`);
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw invalid(`${label} must be a real directory, not a symbolic link`);
  }
  const canonical = await realpath(path).catch((error: unknown) => {
    throw filesystemError(error, `${label} is not accessible`);
  });
  const canonicalMetadata = await lstat(canonical).catch((error: unknown) => {
    throw filesystemError(error, `${label} is not accessible`);
  });
  if (canonicalMetadata.isSymbolicLink() || !canonicalMetadata.isDirectory()) {
    throw invalid(`${label} must remain a real directory`);
  }
  return directoryFrom(canonical, canonicalMetadata);
}

async function assertPinnedDirectory(directory: PinnedDirectory, label: string): Promise<void> {
  const metadata = await lstat(directory.path).catch((error: unknown) => {
    throw filesystemError(error, `${label} changed during the operation`);
  });
  if (metadata.isSymbolicLink() || !metadata.isDirectory() || !sameDirectory(metadata, directory)) {
    throw invalid(`${label} changed during the operation`);
  }
}

async function optionalChildDirectory(
  parent: PinnedDirectory,
  name: string,
  label: string,
): Promise<PinnedDirectory | null> {
  await assertPinnedDirectory(parent, `${label} parent`);
  const path = join(parent.path, name);
  let metadata: Stats;
  try {
    metadata = await lstat(path);
  } catch (error) {
    if (isErrno(error, "ENOENT")) return null;
    throw filesystemError(error, `${label} is not accessible`);
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw invalid(`${label} must be a real directory, not a symbolic link`);
  }
  const child = await pinDirectory(path, label);
  if (dirname(child.path) !== parent.path) throw invalid(`${label} must stay inside its parent`);
  await assertPinnedDirectory(parent, `${label} parent`);
  return child;
}

async function ensureChildDirectory(
  parent: PinnedDirectory,
  name: string,
  label: string,
): Promise<PinnedDirectory> {
  const existing = await optionalChildDirectory(parent, name, label);
  if (existing !== null) return existing;
  await assertPinnedDirectory(parent, `${label} parent`);
  try {
    await mkdir(join(parent.path, name), { mode: 0o700 });
  } catch (error) {
    if (!isErrno(error, "EEXIST")) throw filesystemError(error, `Unable to create ${label}`);
  }
  const child = await optionalChildDirectory(parent, name, label);
  if (child === null) throw invalid(`${label} disappeared while it was being created`);
  await syncDirectory(parent);
  return child;
}

async function syncDirectory(directory: PinnedDirectory): Promise<void> {
  await assertPinnedDirectory(directory, "Recovery storage directory");
  const handle = await open(directory.path, constants.O_RDONLY).catch((error: unknown) => {
    throw filesystemError(error, "Recovery storage directory could not be synchronized");
  });
  try {
    await handle.sync().catch((error: unknown) => {
      throw filesystemError(error, "Recovery storage directory could not be synchronized");
    });
  } finally {
    await handle.close().catch(() => undefined);
  }
}

async function optionalFileIdentity(path: string, label: string): Promise<FileIdentity | null> {
  let metadata: Stats;
  try {
    metadata = await lstat(path);
  } catch (error) {
    if (isErrno(error, "ENOENT")) return null;
    throw filesystemError(error, `${label} is not accessible`);
  }
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw invalid(`${label} must be a regular file, not a symbolic link`);
  }
  if (metadata.nlink !== 1) throw invalid(`${label} must not be hard linked`);
  return fileFrom(metadata);
}

async function readManifestFile(
  directory: PinnedDirectory,
  repositoryId: RepositoryId,
): Promise<readonly StoredRecoveryEntry[] | null> {
  await assertPinnedDirectory(directory, "Recovery storage directory");
  const path = join(directory.path, `${repositoryId}.json`);
  const before = await optionalFileIdentity(path, "Recovery manifest");
  if (before === null) return null;
  if (before.size > MAX_RECOVERY_MANIFEST_BYTES) {
    throw new GitUtilityError(
      "outputLimit",
      `Recovery manifest exceeds ${MAX_RECOVERY_MANIFEST_BYTES} bytes`,
    );
  }
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW).catch(
    (error: unknown) => {
      throw invalid(
        `Recovery manifest could not be opened safely (${safeErrorMessage(error instanceof Error ? error.message : "open failed")})`,
      );
    },
  );
  let bytes: Buffer;
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || opened.nlink !== 1 || !sameFile(opened, before)) {
      throw invalid("Recovery manifest changed before it could be read");
    }
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const chunk = Buffer.allocUnsafe(
        Math.min(64 * 1024, MAX_RECOVERY_MANIFEST_BYTES - total + 1),
      );
      const { bytesRead } = await handle.read(chunk, 0, chunk.byteLength, null);
      if (bytesRead === 0) break;
      chunks.push(Buffer.from(chunk.subarray(0, bytesRead)));
      total += bytesRead;
      if (total > MAX_RECOVERY_MANIFEST_BYTES) {
        throw new GitUtilityError(
          "outputLimit",
          `Recovery manifest exceeds ${MAX_RECOVERY_MANIFEST_BYTES} bytes`,
        );
      }
    }
    bytes = Buffer.concat(chunks);
    const openedAfter = await handle.stat();
    if (!sameFile(openedAfter, before) || openedAfter.nlink !== 1) {
      throw invalid("Recovery manifest changed while it was being read");
    }
  } finally {
    await handle.close().catch(() => undefined);
  }
  const after = await optionalFileIdentity(path, "Recovery manifest");
  if (after === null || !sameFileIdentity(after, before)) {
    throw invalid("Recovery manifest changed while it was being read");
  }
  await assertPinnedDirectory(directory, "Recovery storage directory");
  if (!isUtf8(bytes)) throw invalid("Recovery manifest must contain valid UTF-8");
  let decoded: unknown;
  try {
    decoded = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw invalid("Recovery manifest is not valid JSON");
  }
  const parsed = RecoveryManifestSchema.safeParse(decoded);
  let entries: readonly StoredRecoveryEntry[];
  let expectedChecksum: string;
  let storedChecksum: string;
  if (parsed.success) {
    entries = parsed.data.entries.map(copyStoredEntry);
    expectedChecksum = checksum(payloadBytes(manifestPayload(entries)));
    storedChecksum = parsed.data.sha256;
  } else {
    const legacy = LegacyRecoveryManifestSchema.safeParse(decoded);
    if (!legacy.success) throw invalid("Recovery manifest is invalid");
    const legacyEntries = legacy.data.entries.map(copyEntry);
    entries = legacyEntries.map((entry) => ({ ...entry, snapshot: null }));
    expectedChecksum = checksum(payloadBytes(legacyManifestPayload(legacyEntries)));
    storedChecksum = legacy.data.sha256;
  }
  if (expectedChecksum !== storedChecksum) throw invalid("Recovery manifest checksum mismatch");
  for (const entry of entries) {
    if (entry.repositoryId !== repositoryId) {
      throw invalid("Recovery manifest contains an entry for another repository");
    }
  }
  return entries.map(copyStoredEntry);
}

async function writeManifestFile(
  directory: PinnedDirectory,
  repositoryId: RepositoryId,
  entries: readonly StoredRecoveryEntry[],
): Promise<void> {
  const bytes = encodeManifest(entries);
  if (bytes.byteLength > MAX_RECOVERY_MANIFEST_BYTES) {
    throw new GitUtilityError(
      "outputLimit",
      `Recovery manifest exceeds ${MAX_RECOVERY_MANIFEST_BYTES} bytes`,
    );
  }
  await assertPinnedDirectory(directory, "Recovery storage directory");
  const path = join(directory.path, `${repositoryId}.json`);
  const previous = await optionalFileIdentity(path, "Recovery manifest");
  const temporaryPath = join(directory.path, `.${repositoryId}.${randomUUID()}.tmp`);
  let handle;
  let writeFailure: unknown = null;
  let temporaryIdentity: FileIdentity | null = null;
  try {
    handle = await open(
      temporaryPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    await handle.writeFile(bytes);
    await handle.sync();
    const temporary = await handle.stat();
    if (!temporary.isFile() || temporary.nlink !== 1 || temporary.size !== bytes.byteLength) {
      throw invalid("Recovery manifest temporary file is unsafe");
    }
    temporaryIdentity = fileFrom(temporary);
  } catch (error) {
    writeFailure = filesystemError(error, "Recovery manifest could not be written");
  } finally {
    await handle?.close().catch(() => undefined);
  }
  if (writeFailure !== null) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw writeFailure;
  }
  if (temporaryIdentity === null) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw invalid("Recovery manifest temporary file was not verified");
  }
  try {
    await assertPinnedDirectory(directory, "Recovery storage directory");
    const current = await optionalFileIdentity(path, "Recovery manifest");
    if (
      (previous === null && current !== null) ||
      (previous !== null && (current === null || !sameFileIdentity(current, previous)))
    ) {
      throw invalid("Recovery manifest changed while it was being replaced");
    }
    await rename(temporaryPath, path);
    const written = await optionalFileIdentity(path, "Recovery manifest");
    if (written === null || !sameFileIdentity(written, temporaryIdentity)) {
      throw invalid("Recovery manifest did not remain a regular file");
    }
    await syncDirectory(directory);
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function copyEntry(entry: RecoveryEntry): RecoveryEntry {
  return {
    id: entry.id,
    repositoryId: entry.repositoryId,
    operation: entry.operation,
    createdAtMs: entry.createdAtMs,
    branch: entry.branch,
    headOid: entry.headOid,
    refs: entry.refs.map((reference) => ({ ...reference })),
    recoverable: entry.recoverable,
  };
}

function copyStoredEntry(entry: StoredRecoveryEntry): StoredRecoveryEntry {
  return {
    ...copyEntry(entry),
    snapshot: entry.snapshot === null ? null : copyRepositorySnapshot(entry.snapshot),
  };
}

function affectedRefs(
  operation: ValidatedGitOperation,
  currentBranch: string | null,
): AffectedRefs | null {
  const current = (label: string): AffectedRefs | null =>
    currentBranch === null ? null : { operation: label, names: [`refs/heads/${currentBranch}`] };
  switch (operation.kind) {
    case "commit":
    case "commitAdvanced":
      return current("commit");
    case "reset":
      return current("reset");
    case "revert":
      return current("revert");
    case "cherryPick":
      return current("cherry-pick");
    case "merge":
      return current("merge");
    case "rebase":
      return current("rebase");
    case "interactiveRebase":
      return current("interactive rebase");
    case "dropCommits":
      return current("drop commits");
    case "squashCommits":
      return current("squash commits");
    case "rewordCommit":
      return current("reword commit");
    case "undoCommit":
      return current("undo commit");
    case "createFixupCommit":
      return current("fixup commit");
    case "createSquashCommit":
      return current("squash commit");
    case "continue":
      return current("continue operation");
    case "skip":
      return current("skip operation");
    case "abort":
      return current("abort operation");
    case "createBranch":
      return {
        operation: "create branch",
        names: [`refs/heads/${operation.name}`],
      };
    case "renameBranch":
      return {
        operation: "rename branch",
        names: [`refs/heads/${operation.oldName}`, `refs/heads/${operation.newName}`],
      };
    case "deleteBranch":
      return {
        operation: "delete branch",
        names: [`refs/heads/${operation.name}`],
      };
    case "createTag":
      return {
        operation: "create tag",
        names: [`refs/tags/${operation.name}`],
      };
    case "deleteTag":
      return {
        operation: "delete tag",
        names: [`refs/tags/${operation.name}`],
      };
    case "stashPush":
    case "stashApply":
    case "stashDrop":
    case "stashClear":
    case "stashBranch":
      return { operation: "stash", names: ["refs/stash"] };
    default:
      return null;
  }
}

function updateTransaction(
  targets: readonly RecoveryRef[],
  current: ReadonlyMap<string, string | null>,
): { readonly stdin: string; readonly restoredRefs: readonly string[] } | null {
  const commands: string[] = ["start"];
  const restoredRefs: string[] = [];
  for (const target of targets) {
    const oldOid = current.get(target.name) ?? null;
    if (target.oid === oldOid) continue;
    if (target.oid === null && oldOid !== null) {
      commands.push(`delete ${target.name} ${oldOid}`);
    } else if (target.oid !== null && oldOid === null) {
      commands.push(`create ${target.name} ${target.oid}`);
    } else if (target.oid !== null && oldOid !== null) {
      commands.push(`update ${target.name} ${target.oid} ${oldOid}`);
    }
    restoredRefs.push(target.name);
  }
  if (restoredRefs.length === 0) return null;
  commands.push("prepare", "commit");
  return { stdin: `${commands.join("\n")}\n`, restoredRefs };
}

function sameRefs(left: readonly RecoveryRef[], right: readonly RecoveryRef[]): boolean {
  return (
    left.length === right.length &&
    left.every(
      (reference, index) =>
        reference.name === right[index]?.name && reference.oid === right[index]?.oid,
    )
  );
}

class RepositoryMutex {
  readonly #tails = new Map<RepositoryId, Promise<void>>();

  async run<T>(repositoryId: RepositoryId, operation: () => Promise<T>): Promise<T> {
    const previous = this.#tails.get(repositoryId) ?? Promise.resolve();
    let release = (): void => undefined;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.catch(() => undefined).then(() => current);
    this.#tails.set(repositoryId, tail);
    await previous.catch(() => undefined);
    try {
      return await operation();
    } finally {
      release();
      if (this.#tails.get(repositoryId) === tail) this.#tails.delete(repositoryId);
    }
  }
}

export class RecoveryService {
  readonly #registry: RecoveryRepositoryRegistryLike;
  readonly #storageRoot: string;
  readonly #runner: GitProcessRunnerLike;
  readonly #mutex = new RepositoryMutex();

  private constructor(
    registry: RecoveryRepositoryRegistryLike,
    storageRoot: string,
    runner: GitProcessRunnerLike,
  ) {
    this.#registry = registry;
    this.#storageRoot = storageRoot;
    this.#runner = runner;
  }

  static of(
    registry: RecoveryRepositoryRegistryLike,
    storageRoot: string,
    runner: GitProcessRunnerLike = new GitProcessRunner(),
  ): RecoveryService {
    if (
      typeof storageRoot !== "string" ||
      storageRoot.length === 0 ||
      storageRoot.length > 16_384 ||
      storageRoot.includes("\0") ||
      !isAbsolute(storageRoot)
    ) {
      throw invalid("Recovery storage root must be an absolute path");
    }
    return new RecoveryService(registry, storageRoot, runner);
  }

  async recordBeforeOperation(
    repositoryId: RepositoryId,
    untrustedOperation: unknown,
    signal?: AbortSignal,
  ): Promise<RecoveryEntry | null> {
    const validatedRepositoryId = validateRepositoryId(repositoryId);
    const operation = validateOperation(untrustedOperation);
    return this.#mutex.run(validatedRepositoryId, async () => {
      assertNotAborted(signal);
      const repository = await this.#repository(validatedRepositoryId);
      const branch = await this.#currentBranch(repository.path, signal);
      const affected = affectedRefs(operation, branch);
      if (affected === null) return null;
      const refs = await this.#captureRefs(repository.path, affected.names, signal);
      const headOid = await this.#head(repository.path, signal);
      const snapshot = await captureRepositorySnapshot(this.#runner, repository, signal);
      const [finalBranch, finalHeadOid, finalRefs] = await Promise.all([
        this.#currentBranch(repository.path, signal),
        this.#head(repository.path, signal),
        this.#captureRefs(repository.path, affected.names, signal),
      ]);
      if (branch !== finalBranch || headOid !== finalHeadOid || !sameRefs(refs, finalRefs)) {
        throw invalid("Repository refs changed while the recovery snapshot was being captured");
      }
      const entry: StoredRecoveryEntry = {
        id: randomUUID(),
        repositoryId: validatedRepositoryId,
        operation: affected.operation,
        createdAtMs: Date.now(),
        branch,
        headOid,
        refs,
        recoverable: true,
        snapshot,
      };
      await this.#append(validatedRepositoryId, entry, signal);
      return copyEntry(entry);
    });
  }

  async list(repositoryId: RepositoryId, signal?: AbortSignal): Promise<readonly RecoveryEntry[]> {
    const validatedRepositoryId = validateRepositoryId(repositoryId);
    return this.#mutex.run(validatedRepositoryId, async () => {
      assertNotAborted(signal);
      const repository = await this.#repository(validatedRepositoryId);
      const entries = await this.#read(validatedRepositoryId);
      const resolved: RecoveryEntry[] = [];
      for (const entry of entries) {
        assertNotAborted(signal);
        resolved.push({
          ...copyEntry(entry),
          recoverable: await this.#refsAreRecoverable(repository.path, entry.refs, signal),
        });
      }
      return Object.freeze(resolved.sort((left, right) => right.createdAtMs - left.createdAtMs));
    });
  }

  async restore(
    repositoryId: RepositoryId,
    untrustedEntryId: unknown,
    signal?: AbortSignal,
  ): Promise<RecoveryRestoreResult> {
    const validatedRepositoryId = validateRepositoryId(repositoryId);
    const entryId = validateEntryId(untrustedEntryId);
    return this.#mutex.run(validatedRepositoryId, async () => {
      assertNotAborted(signal);
      const repository = await this.#repository(validatedRepositoryId);
      const entries = await this.#read(validatedRepositoryId);
      const entry = entries.find((candidate) => candidate.id === entryId);
      if (entry === undefined) throw invalid("Recovery entry does not exist");
      if (!(await this.#refsAreRecoverable(repository.path, entry.refs, signal))) {
        throw invalid("One or more recorded objects are no longer available");
      }
      const currentRefs = await this.#captureRefs(
        repository.path,
        entry.refs.map((reference) => reference.name),
        signal,
      );
      const currentBranch = await this.#currentBranch(repository.path, signal);
      const currentHeadOid = await this.#head(repository.path, signal);
      const currentSnapshot = await captureRepositorySnapshot(this.#runner, repository, signal);
      const [finalBranch, finalHeadOid, finalRefs] = await Promise.all([
        this.#currentBranch(repository.path, signal),
        this.#head(repository.path, signal),
        this.#captureRefs(
          repository.path,
          entry.refs.map((reference) => reference.name),
          signal,
        ),
      ]);
      if (
        currentBranch !== finalBranch ||
        currentHeadOid !== finalHeadOid ||
        !sameRefs(currentRefs, finalRefs)
      ) {
        throw invalid("Repository changed while the inverse recovery snapshot was being captured");
      }
      const inverse: StoredRecoveryEntry = {
        id: randomUUID(),
        repositoryId: validatedRepositoryId,
        operation: `restore ${entry.operation}`,
        createdAtMs: Date.now(),
        branch: currentBranch,
        headOid: currentHeadOid,
        refs: currentRefs,
        recoverable: true,
        snapshot: currentSnapshot,
      };
      await this.#append(validatedRepositoryId, inverse, signal);
      assertNotAborted(signal);
      const current = new Map(currentRefs.map((reference) => [reference.name, reference.oid]));
      const transaction = updateTransaction(entry.refs, current);
      if (entry.snapshot === null) {
        if (transaction === null) return { entryId, restoredRefs: [] };
        await runGit(
          this.#runner,
          repository.path,
          ["update-ref", "--stdin"],
          signal,
          transaction.stdin,
        );
        return { entryId, restoredRefs: [...transaction.restoredRefs] };
      }

      let refsApplied = false;
      try {
        await restoreRepositorySnapshot(
          this.#runner,
          repository,
          entry.snapshot,
          currentSnapshot,
          signal,
          false,
        );
        assertNotAborted(signal);
        if (transaction !== null) {
          await runGit(
            this.#runner,
            repository.path,
            ["update-ref", "--stdin"],
            signal,
            transaction.stdin,
          );
          refsApplied = true;
        }
        const restored = await captureRepositorySnapshot(this.#runner, repository, signal);
        if (!repositorySnapshotsEqual(restored, entry.snapshot)) {
          throw invalid("Repository snapshot verification failed after recovery");
        }
        return {
          entryId,
          restoredRefs: transaction === null ? [] : [...transaction.restoredRefs],
        };
      } catch (error) {
        try {
          const partial = await captureRepositorySnapshot(this.#runner, repository);
          await restoreRepositorySnapshot(
            this.#runner,
            repository,
            currentSnapshot,
            partial,
            undefined,
            false,
          );
          if (refsApplied) {
            const rollbackCurrentRefs = await this.#captureRefs(
              repository.path,
              entry.refs.map((reference) => reference.name),
              undefined,
            );
            if (!sameRefs(rollbackCurrentRefs, entry.refs)) {
              throw invalid("Repository refs changed before recovery could be rolled back");
            }
            const rollbackCurrent = new Map(
              rollbackCurrentRefs.map((reference) => [reference.name, reference.oid]),
            );
            const rollbackTransaction = updateTransaction(currentRefs, rollbackCurrent);
            if (rollbackTransaction !== null) {
              await runGit(
                this.#runner,
                repository.path,
                ["update-ref", "--stdin"],
                undefined,
                rollbackTransaction.stdin,
              );
            }
          }
          const rolledBack = await captureRepositorySnapshot(this.#runner, repository);
          if (!repositorySnapshotsEqual(rolledBack, currentSnapshot)) {
            throw invalid("Repository snapshot rollback verification failed");
          }
        } catch (rollbackError) {
          throw new GitUtilityError(
            "commandFailed",
            `Recovery failed and rollback could not be completed (${safeErrorMessage(
              rollbackError instanceof Error ? rollbackError.message : "rollback failed",
            )})`,
          );
        }
        throw error;
      }
    });
  }

  async #repository(repositoryId: RepositoryId): Promise<RepositoryRecord> {
    const repository = this.#registry.get(repositoryId);
    if (repository.id !== repositoryId) {
      throw new GitUtilityError("repositoryNotOpen", "Repository registry identity changed");
    }
    const directory = await pinDirectory(repository.path, "Repository root");
    if (directory.path !== repository.path) {
      throw new GitUtilityError("repositoryNotOpen", "Canonical repository path changed");
    }
    return repository;
  }

  async #currentBranch(
    repository: string,
    signal: AbortSignal | undefined,
  ): Promise<string | null> {
    const branch = await captureOptional(
      this.#runner,
      repository,
      ["symbolic-ref", "--quiet", "--short", "HEAD"],
      [1],
      signal,
    );
    if (branch !== null && !hasSafeRefStructure(branch)) {
      throw invalid("Git returned an invalid current branch name");
    }
    return branch;
  }

  async #head(repository: string, signal: AbortSignal | undefined): Promise<string | null> {
    const oid = await captureOptional(
      this.#runner,
      repository,
      ["rev-parse", "--verify", "--end-of-options", "HEAD"],
      [128],
      signal,
    );
    if (oid !== null && !ObjectIdSchema.safeParse(oid).success) {
      throw invalid("Git returned an invalid HEAD object id");
    }
    return oid;
  }

  async #captureRefs(
    repository: string,
    names: readonly string[],
    signal: AbortSignal | undefined,
  ): Promise<RecoveryRef[]> {
    const refs: RecoveryRef[] = [];
    for (const name of names) {
      await this.#validateRef(repository, name, signal);
      const oid = await captureOptional(
        this.#runner,
        repository,
        ["rev-parse", "--verify", "--end-of-options", name],
        [128],
        signal,
      );
      if (oid !== null && !ObjectIdSchema.safeParse(oid).success) {
        throw invalid(`Git returned an invalid object id for ${name}`);
      }
      refs.push({ name, oid });
    }
    return refs;
  }

  async #validateRef(
    repository: string,
    name: string,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    if (!hasSafeRefStructure(name)) throw invalid("Recovery ref name is invalid");
    const outcome = await this.#runner.run(
      {
        cwd: repository,
        args: ["check-ref-format", name],
        outputLimitBytes: MAX_RECOVERY_DIAGNOSTIC_BYTES,
      },
      signal,
    );
    if (outcome.kind === "completed") return;
    if (outcome.kind === "failed" && outcome.code === "commandFailed") {
      throw invalid(`Recovery ref name is invalid (${name})`);
    }
    throw processFailure(outcome);
  }

  async #refsAreRecoverable(
    repository: string,
    refs: readonly RecoveryRef[],
    signal: AbortSignal | undefined,
  ): Promise<boolean> {
    for (const reference of refs) {
      assertNotAborted(signal);
      if (reference.oid === null) continue;
      const outcome = await this.#runner.run(
        {
          cwd: repository,
          args: ["cat-file", "-e", `${reference.oid}^{object}`],
          outputLimitBytes: MAX_RECOVERY_DIAGNOSTIC_BYTES,
        },
        signal,
      );
      if (outcome.kind === "completed") continue;
      if (outcome.kind === "failed" && outcome.code === "commandFailed") return false;
      throw processFailure(outcome);
    }
    return true;
  }

  async #read(repositoryId: RepositoryId): Promise<readonly StoredRecoveryEntry[]> {
    const root = await pinDirectory(this.#storageRoot, "Recovery storage root");
    const directory = await optionalChildDirectory(
      root,
      RECOVERY_DIRECTORY,
      "Recovery storage directory",
    );
    if (directory === null) return [];
    return (await readManifestFile(directory, repositoryId)) ?? [];
  }

  async #append(
    repositoryId: RepositoryId,
    entry: StoredRecoveryEntry,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    assertNotAborted(signal);
    const root = await pinDirectory(this.#storageRoot, "Recovery storage root");
    const directory = await ensureChildDirectory(
      root,
      RECOVERY_DIRECTORY,
      "Recovery storage directory",
    );
    const entries = (await readManifestFile(directory, repositoryId)) ?? [];
    const next = [copyStoredEntry(entry), ...entries.map(copyStoredEntry)].slice(
      0,
      MAX_RECOVERY_ENTRIES,
    );
    while (next.length > 1 && encodeManifest(next).byteLength > MAX_RECOVERY_MANIFEST_BYTES) {
      next.pop();
    }
    if (encodeManifest(next).byteLength > MAX_RECOVERY_MANIFEST_BYTES) {
      throw new GitUtilityError(
        "outputLimit",
        `Recovery manifest exceeds ${MAX_RECOVERY_MANIFEST_BYTES} bytes`,
      );
    }
    assertNotAborted(signal);
    await writeManifestFile(directory, repositoryId, next);
  }
}
