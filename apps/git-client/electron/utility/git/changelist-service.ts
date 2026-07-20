import { Buffer, isUtf8 } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import type { Stats } from "node:fs";
import { chmod, lstat, mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { z } from "zod";
import {
  RepositoryIdSchema,
  type RepositoryId,
  type RepositoryRecord,
} from "../../../src/shared/contracts/git-utility";
import type {
  Changelist,
  ChangelistCommitOptions,
  ChangelistCommitResult,
} from "../../../src/shared/contracts/model";
import { GitUtilityError } from "./git-error";
import {
  PATCH_COMMAND_TIMEOUT_MS,
  PatchProcessRunner,
  type PatchProcessCompleted,
  type PatchProcessOutcome,
  type PatchProcessRunnerLike,
} from "./patch-service";
import { safeErrorMessage } from "./redaction";
import { validateRelativePath } from "./validation";

export const MAX_CHANGELISTS = 10_000;
export const MAX_CHANGELIST_PATHS = 10_000;
export const MAX_CHANGELIST_MANIFEST_BYTES = 16 * 1024 * 1024;

const MAX_CHANGELIST_NAME_BYTES = 1024 * 1024;
const MAX_CHANGELIST_PATH_BYTES = 1024 * 1024;
const MAX_GIT_OUTPUT_BYTES = 16 * 1024 * 1024;
const MAX_GIT_DIAGNOSTIC_BYTES = 1024 * 1024;
const MAX_INDEX_BYTES = 256 * 1024 * 1024;
const MANIFEST_VERSION = 1;
const MANIFEST_DIRECTORY = "changelists";

const UuidSchema = z.uuid();
const ObjectIdSchema = z.string().regex(/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/u);
const ChecksumSchema = z.string().regex(/^[0-9a-f]{64}$/u);
const PersistedChangelistSchema = z
  .object({
    id: UuidSchema,
    repositoryId: UuidSchema,
    name: z.string().min(1).max(MAX_CHANGELIST_NAME_BYTES),
    paths: z.array(z.string().min(1).max(16_384)).max(MAX_CHANGELIST_PATHS),
    createdAtMs: z.number().int().nonnegative().safe(),
    updatedAtMs: z.number().int().nonnegative().safe(),
  })
  .strict();
const ManifestPayloadSchema = z
  .object({
    version: z.literal(MANIFEST_VERSION),
    repositoryId: UuidSchema,
    changelists: z.array(PersistedChangelistSchema).max(MAX_CHANGELISTS),
  })
  .strict();
const ManifestEnvelopeSchema = ManifestPayloadSchema.extend({
  checksum: ChecksumSchema,
}).strict();
const CommitOptionsSchema = z
  .object({
    message: z.string().min(1).max(MAX_CHANGELIST_NAME_BYTES),
    amend: z.boolean(),
    signOff: z.boolean(),
    gpgSign: z.boolean(),
  })
  .strict();

interface ManifestPayload {
  readonly version: typeof MANIFEST_VERSION;
  readonly repositoryId: RepositoryId;
  readonly changelists: readonly Changelist[];
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

interface IndexBackupBase {
  readonly path: string;
  readonly parent: PinnedDirectory;
}

interface MissingIndexBackup extends IndexBackupBase {
  readonly kind: "missing";
}

interface PresentIndexBackup extends IndexBackupBase {
  readonly kind: "present";
  readonly bytes: Buffer;
  readonly mode: number;
}

type IndexBackup = MissingIndexBackup | PresentIndexBackup;

type OptionalBytes = Readonly<{ kind: "missing" }> | Readonly<{ kind: "present"; bytes: Buffer }>;

interface OriginalHead {
  readonly oid: string | null;
  readonly symbolicRef: string | null;
}

interface SaveInput {
  readonly id: string | null;
  readonly name: string;
  readonly paths: readonly string[];
}

export interface ChangelistRepositoryRegistryLike {
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

function sameIdentity(metadata: Stats, identity: PinnedDirectory | FileIdentity): boolean {
  return metadata.dev === identity.device && metadata.ino === identity.inode;
}

function pinnedDirectory(path: string, metadata: Stats): PinnedDirectory {
  return { path, device: metadata.dev, inode: metadata.ino };
}

function fileIdentity(metadata: Stats): FileIdentity {
  return { device: metadata.dev, inode: metadata.ino, size: metadata.size };
}

function checksum(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function payloadBytes(payload: ManifestPayload): Buffer {
  return Buffer.from(JSON.stringify(payload), "utf8");
}

function encodedManifest(payload: ManifestPayload): Buffer {
  if (!ManifestPayloadSchema.safeParse(payload).success) {
    throw invalid("Changelist manifest payload is invalid");
  }
  const envelope = {
    ...payload,
    checksum: checksum(payloadBytes(payload)),
  };
  const bytes = Buffer.from(JSON.stringify(envelope, null, 2), "utf8");
  if (bytes.byteLength > MAX_CHANGELIST_MANIFEST_BYTES) {
    throw new GitUtilityError("outputLimit", "Changelist manifest exceeds 16 MiB");
  }
  return bytes;
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted !== true) return;
  const suffix = signal.reason === "repositoryClosed" ? " because the repository closed" : "";
  throw new GitUtilityError("commandFailed", `Changelist command cancelled${suffix}`);
}

function validateRepositoryId(untrusted: unknown): RepositoryId {
  const result = RepositoryIdSchema.safeParse(untrusted);
  if (!result.success) throw invalid("Repository id must be a UUID");
  return result.data;
}

function validateChangelistId(untrusted: unknown): string {
  const result = UuidSchema.safeParse(untrusted);
  if (!result.success) throw invalid("Changelist id must be a UUID");
  return result.data;
}

function normalizedPath(untrusted: unknown): string {
  if (typeof untrusted !== "string") {
    throw invalid("Every changelist path must be a string");
  }
  validateRelativePath(untrusted);
  const normalized = normalize(untrusted);
  const components = untrusted.split(sep);
  if (
    normalized !== untrusted ||
    components.some(
      (component) => component.length === 0 || component === "." || component === "..",
    )
  ) {
    throw invalid("Changelist paths must be normalized relative paths");
  }
  return untrusted;
}

function validatePaths(untrusted: unknown): readonly string[] {
  if (!Array.isArray(untrusted) || untrusted.length > MAX_CHANGELIST_PATHS) {
    throw invalid(`Changelist paths must contain at most ${MAX_CHANGELIST_PATHS} entries`);
  }
  const paths = new Set<string>();
  let totalBytes = 0;
  for (const value of untrusted) {
    const path = normalizedPath(value);
    totalBytes += Buffer.byteLength(path, "utf8");
    if (totalBytes > MAX_CHANGELIST_PATH_BYTES) {
      throw new GitUtilityError("outputLimit", "Changelist paths exceed 1 MiB");
    }
    paths.add(path);
  }
  return Object.freeze([...paths].sort(compareUtf8));
}

function validateSaveInput(
  untrustedId: unknown,
  untrustedName: unknown,
  untrustedPaths: unknown,
): SaveInput {
  if (untrustedId !== null && typeof untrustedId !== "string") {
    throw invalid("Changelist id must be null or a UUID");
  }
  const id = untrustedId === null ? null : validateChangelistId(untrustedId);
  if (typeof untrustedName !== "string") {
    throw invalid("Changelist name must be a string");
  }
  const name = untrustedName.trim();
  if (
    name.length === 0 ||
    name.includes("\0") ||
    Buffer.byteLength(name, "utf8") > MAX_CHANGELIST_NAME_BYTES
  ) {
    throw invalid("Changelist name must be non-empty, contain no NUL, and not exceed 1 MiB");
  }
  return { id, name, paths: validatePaths(untrustedPaths) };
}

function validateCommitOptions(untrusted: unknown): ChangelistCommitOptions {
  const result = CommitOptionsSchema.safeParse(untrusted);
  if (!result.success) throw invalid("Changelist commit options are invalid");
  if (result.data.message.trim().length === 0 || result.data.message.includes("\0")) {
    throw invalid("Commit message must be non-empty and contain no NUL");
  }
  return result.data;
}

function cloneChangelist(changelist: Changelist): Changelist {
  return { ...changelist, paths: [...changelist.paths] };
}

function clonePayload(payload: ManifestPayload): ManifestPayload {
  return {
    version: MANIFEST_VERSION,
    repositoryId: payload.repositoryId,
    changelists: payload.changelists.map(cloneChangelist),
  };
}

function validatePayload(untrusted: unknown, repositoryId: RepositoryId): ManifestPayload {
  const parsed = ManifestEnvelopeSchema.safeParse(untrusted);
  if (!parsed.success) throw invalid("Changelist manifest is invalid");
  const { checksum: storedChecksum, ...rawPayload } = parsed.data;
  const payload: ManifestPayload = {
    version: MANIFEST_VERSION,
    repositoryId: rawPayload.repositoryId,
    changelists: rawPayload.changelists.map((item) => ({
      ...item,
      paths: [...item.paths],
    })),
  };
  if (payload.repositoryId !== repositoryId) {
    throw invalid("Changelist manifest repository identity does not match");
  }
  if (checksum(payloadBytes(payload)) !== storedChecksum) {
    throw invalid("Changelist manifest checksum mismatch");
  }
  const ids = new Set<string>();
  for (const changelist of payload.changelists) {
    if (changelist.repositoryId !== repositoryId) {
      throw invalid("Changelist repository identity does not match");
    }
    if (ids.has(changelist.id)) {
      throw invalid("Changelist manifest contains duplicate ids");
    }
    ids.add(changelist.id);
    if (
      changelist.name.trim() !== changelist.name ||
      changelist.name.includes("\0") ||
      changelist.updatedAtMs < changelist.createdAtMs
    ) {
      throw invalid("Changelist manifest contains an invalid entry");
    }
    const paths = validatePaths(changelist.paths);
    if (
      paths.length !== changelist.paths.length ||
      paths.some((path, index) => path !== changelist.paths[index])
    ) {
      throw invalid("Changelist manifest paths are not sorted and unique");
    }
  }
  return clonePayload(payload);
}

async function pinDirectory(path: string, label: string): Promise<PinnedDirectory> {
  let before: Stats;
  try {
    before = await lstat(path);
  } catch (error) {
    throw filesystemError(error, `${label} is not accessible`);
  }
  if (before.isSymbolicLink() || !before.isDirectory()) {
    throw invalid(`${label} must be a real directory, not a symbolic link`);
  }
  const canonical = await realpath(path).catch((error: unknown) => {
    throw filesystemError(error, `${label} is not accessible`);
  });
  const after = await lstat(canonical).catch((error: unknown) => {
    throw filesystemError(error, `${label} is not accessible`);
  });
  if (
    after.isSymbolicLink() ||
    !after.isDirectory() ||
    !sameIdentity(after, pinnedDirectory(canonical, before))
  ) {
    throw invalid(`${label} changed while it was being opened`);
  }
  return pinnedDirectory(canonical, after);
}

async function assertPinnedDirectory(directory: PinnedDirectory, label: string): Promise<void> {
  const metadata = await lstat(directory.path).catch((error: unknown) => {
    throw filesystemError(error, `${label} changed during the operation`);
  });
  if (metadata.isSymbolicLink() || !metadata.isDirectory() || !sameIdentity(metadata, directory)) {
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
  if (dirname(child.path) !== parent.path) {
    throw invalid(`${label} escaped its parent directory`);
  }
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
    if (!isErrno(error, "EEXIST")) {
      throw filesystemError(error, `Unable to create ${label}`);
    }
  }
  const created = await optionalChildDirectory(parent, name, label);
  if (created === null) throw invalid(`${label} disappeared while being created`);
  return created;
}

async function ensureStorageRoot(path: string): Promise<PinnedDirectory> {
  await mkdir(path, { recursive: true, mode: 0o700 }).catch((error: unknown) => {
    throw filesystemError(error, "Unable to create changelist storage root");
  });
  return pinDirectory(path, "Changelist storage root");
}

async function readContainedFile(
  parent: PinnedDirectory,
  name: string,
  maximumBytes: number,
  label: string,
): Promise<OptionalBytes> {
  await assertPinnedDirectory(parent, `${label} parent`);
  const path = join(parent.path, name);
  let before: Stats;
  try {
    before = await lstat(path);
  } catch (error) {
    if (isErrno(error, "ENOENT")) return { kind: "missing" };
    throw filesystemError(error, `${label} is not accessible`);
  }
  if (before.isSymbolicLink() || !before.isFile()) {
    throw invalid(`${label} must be a regular file, not a symbolic link`);
  }
  if (before.size > maximumBytes) {
    throw new GitUtilityError("outputLimit", `${label} is too large`);
  }
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    throw invalid(
      `${label} could not be opened safely (${safeErrorMessage(error instanceof Error ? error.message : "open failed")})`,
    );
  }
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || !sameIdentity(opened, fileIdentity(before))) {
      throw invalid(`${label} changed before it could be read`);
    }
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    while (true) {
      const remaining = maximumBytes - totalBytes + 1;
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, remaining));
      const { bytesRead } = await handle.read(chunk, 0, chunk.byteLength, null);
      if (bytesRead === 0) break;
      chunks.push(Buffer.from(chunk.subarray(0, bytesRead)));
      totalBytes += bytesRead;
      if (totalBytes > maximumBytes) {
        throw new GitUtilityError("outputLimit", `${label} is too large`);
      }
    }
    const after = await lstat(path).catch(() => null);
    if (
      after === null ||
      after.isSymbolicLink() ||
      !after.isFile() ||
      !sameIdentity(after, fileIdentity(opened))
    ) {
      throw invalid(`${label} changed while it was being read`);
    }
    await assertPinnedDirectory(parent, `${label} parent`);
    return { kind: "present", bytes: Buffer.concat(chunks, totalBytes) };
  } finally {
    await handle.close().catch(() => undefined);
  }
}

async function syncDirectory(directory: PinnedDirectory): Promise<void> {
  await assertPinnedDirectory(directory, "Changelist directory");
  const handle = await open(directory.path, constants.O_RDONLY).catch((error: unknown) => {
    throw filesystemError(error, "Changelist directory cannot be synchronized");
  });
  try {
    await handle.sync().catch((error: unknown) => {
      throw filesystemError(error, "Changelist directory cannot be synchronized");
    });
  } finally {
    await handle.close().catch(() => undefined);
  }
}

async function atomicWriteContainedFile(
  parent: PinnedDirectory,
  name: string,
  bytes: Buffer,
  signal: AbortSignal | undefined,
): Promise<void> {
  assertNotAborted(signal);
  await assertPinnedDirectory(parent, "Changelist manifest parent");
  const destination = join(parent.path, name);
  const temporary = join(parent.path, `.${name}.${randomUUID()}.tmp`);
  let handle;
  let temporaryIdentity: FileIdentity | null = null;
  try {
    const destinationBefore = await lstat(destination).catch((error: unknown) => {
      if (isErrno(error, "ENOENT")) return null;
      throw filesystemError(error, "Changelist manifest is not accessible");
    });
    if (
      destinationBefore !== null &&
      (destinationBefore.isSymbolicLink() || !destinationBefore.isFile())
    ) {
      throw invalid("Changelist manifest must be a regular file, not a symbolic link");
    }
    handle = await open(
      temporary,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    await handle.writeFile(bytes);
    await handle.sync();
    const metadata = await handle.stat();
    if (!metadata.isFile()) throw invalid("Temporary changelist manifest is invalid");
    temporaryIdentity = fileIdentity(metadata);
    await handle.close();
    handle = null;

    assertNotAborted(signal);
    await assertPinnedDirectory(parent, "Changelist manifest parent");
    const temporaryBeforeRename = await lstat(temporary);
    if (
      temporaryBeforeRename.isSymbolicLink() ||
      !temporaryBeforeRename.isFile() ||
      !sameIdentity(temporaryBeforeRename, temporaryIdentity)
    ) {
      throw invalid("Temporary changelist manifest changed before commit");
    }
    const destinationBeforeRename = await lstat(destination).catch((error: unknown) => {
      if (isErrno(error, "ENOENT")) return null;
      throw filesystemError(error, "Changelist manifest is not accessible");
    });
    if (
      destinationBeforeRename !== null &&
      (destinationBeforeRename.isSymbolicLink() || !destinationBeforeRename.isFile())
    ) {
      throw invalid("Changelist manifest changed before commit");
    }
    await rename(temporary, destination);
    temporaryIdentity = null;
    await syncDirectory(parent);
    const persisted = await readContainedFile(
      parent,
      name,
      MAX_CHANGELIST_MANIFEST_BYTES,
      "Changelist manifest",
    );
    if (persisted.kind === "missing" || !persisted.bytes.equals(bytes)) {
      throw invalid("Changelist manifest failed post-write verification");
    }
  } catch (error) {
    throw filesystemError(error, "Unable to persist changelist manifest");
  } finally {
    if (handle !== undefined && handle !== null) {
      await handle.close().catch(() => undefined);
    }
    if (temporaryIdentity !== null) {
      const metadata = await lstat(temporary).catch(() => null);
      if (
        metadata !== null &&
        metadata.isFile() &&
        !metadata.isSymbolicLink() &&
        sameIdentity(metadata, temporaryIdentity)
      ) {
        await unlink(temporary).catch(() => undefined);
      }
    }
  }
}

function processFailure(
  outcome: Exclude<PatchProcessOutcome, PatchProcessCompleted>,
): GitUtilityError {
  if (outcome.kind === "cancelled") {
    const suffix =
      outcome.reason === "timeout"
        ? " timed out"
        : outcome.reason === "repositoryClosed"
          ? " cancelled because the repository closed"
          : " cancelled";
    return new GitUtilityError("commandFailed", `Changelist Git command${suffix}`);
  }
  const detail = outcome.stderr.byteLength > 0 ? outcome.stderr.toString("utf8") : outcome.message;
  return new GitUtilityError(outcome.code, safeErrorMessage(detail), outcome.exitCode);
}

async function gitOutcome(
  runner: PatchProcessRunnerLike,
  repository: RepositoryRecord,
  args: readonly string[],
  signal: AbortSignal | undefined,
  stdoutLimitBytes = MAX_GIT_OUTPUT_BYTES,
): Promise<PatchProcessOutcome> {
  assertNotAborted(signal);
  return runner.run(
    {
      cwd: repository.path,
      args,
      timeoutMs: PATCH_COMMAND_TIMEOUT_MS,
      stdoutLimitBytes,
      stderrLimitBytes: MAX_GIT_DIAGNOSTIC_BYTES,
    },
    signal,
  );
}

async function captureGit(
  runner: PatchProcessRunnerLike,
  repository: RepositoryRecord,
  args: readonly string[],
  signal: AbortSignal | undefined,
  stdoutLimitBytes = MAX_GIT_OUTPUT_BYTES,
): Promise<Buffer> {
  const outcome = await gitOutcome(runner, repository, args, signal, stdoutLimitBytes);
  if (outcome.kind !== "completed") throw processFailure(outcome);
  return outcome.stdout;
}

async function captureOptionalGit(
  runner: PatchProcessRunnerLike,
  repository: RepositoryRecord,
  args: readonly string[],
  signal: AbortSignal | undefined,
): Promise<OptionalBytes> {
  const outcome = await gitOutcome(runner, repository, args, signal);
  if (outcome.kind === "completed") {
    return { kind: "present", bytes: outcome.stdout };
  }
  if (outcome.kind === "failed" && outcome.exitCode === 1) {
    return { kind: "missing" };
  }
  throw processFailure(outcome);
}

function decodedGitText(bytes: Buffer, label: string): string {
  if (!isUtf8(bytes) || bytes.includes(0)) {
    throw invalid(`Git returned invalid text for ${label}`);
  }
  return bytes.toString("utf8").trim();
}

function isContainedPath(parent: string, child: string): boolean {
  const difference = relative(parent, child);
  return (
    difference === "" ||
    (!difference.startsWith(`..${sep}`) && difference !== ".." && !isAbsolute(difference))
  );
}

async function pinRepository(repository: RepositoryRecord): Promise<PinnedDirectory> {
  if (repository.isBare) throw invalid("Changelists require a working tree");
  const root = await pinDirectory(repository.path, "Repository root");
  if (root.path !== repository.path) {
    throw new GitUtilityError("repositoryNotOpen", "Canonical repository path changed");
  }
  return root;
}

async function readRegularFile(
  path: string,
  parent: PinnedDirectory,
  maximumBytes: number,
): Promise<{ readonly bytes: Buffer; readonly mode: number } | null> {
  await assertPinnedDirectory(parent, "Git index parent");
  let before: Stats;
  try {
    before = await lstat(path);
  } catch (error) {
    if (isErrno(error, "ENOENT")) return null;
    throw filesystemError(error, "Git index is not accessible");
  }
  if (before.isSymbolicLink() || !before.isFile()) {
    throw invalid("Git index must be a regular file, not a symbolic link");
  }
  if (before.size > maximumBytes) {
    throw new GitUtilityError("outputLimit", "Git index exceeds 256 MiB");
  }
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW).catch(
    (error: unknown) => {
      throw filesystemError(error, "Git index cannot be opened safely");
    },
  );
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || !sameIdentity(opened, fileIdentity(before))) {
      throw invalid("Git index changed before it could be backed up");
    }
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    while (true) {
      const remaining = maximumBytes - totalBytes + 1;
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, remaining));
      const { bytesRead } = await handle.read(chunk, 0, chunk.byteLength, null);
      if (bytesRead === 0) break;
      chunks.push(Buffer.from(chunk.subarray(0, bytesRead)));
      totalBytes += bytesRead;
      if (totalBytes > maximumBytes) {
        throw new GitUtilityError("outputLimit", "Git index exceeds 256 MiB");
      }
    }
    const after = await lstat(path).catch(() => null);
    if (
      after === null ||
      after.isSymbolicLink() ||
      !after.isFile() ||
      !sameIdentity(after, fileIdentity(opened))
    ) {
      throw invalid("Git index changed while it was being backed up");
    }
    return {
      bytes: Buffer.concat(chunks, totalBytes),
      mode: opened.mode & 0o777,
    };
  } finally {
    await handle.close().catch(() => undefined);
  }
}

async function backupIndex(
  runner: PatchProcessRunnerLike,
  repository: RepositoryRecord,
  signal: AbortSignal | undefined,
): Promise<IndexBackup> {
  const rawPath = await captureGit(
    runner,
    repository,
    ["rev-parse", "--git-path", "index"],
    signal,
    64 * 1024,
  );
  const displayedPath = decodedGitText(rawPath, "the index path");
  if (displayedPath.length === 0) throw invalid("Git returned an empty index path");
  const path = isAbsolute(displayedPath)
    ? normalize(displayedPath)
    : resolve(repository.path, displayedPath);
  const canonicalGitDirectory = await realpath(repository.gitDirectory).catch((error: unknown) => {
    throw filesystemError(error, "Git directory is not accessible");
  });
  const parent = await pinDirectory(dirname(path), "Git index parent");
  if (!isContainedPath(canonicalGitDirectory, parent.path)) {
    throw invalid("Git index path escaped the repository Git directory");
  }
  const existing = await readRegularFile(path, parent, MAX_INDEX_BYTES);
  return existing === null
    ? { kind: "missing", path, parent }
    : {
        kind: "present",
        path,
        parent,
        bytes: existing.bytes,
        mode: existing.mode,
      };
}

async function restoreIndex(backup: IndexBackup): Promise<void> {
  await assertPinnedDirectory(backup.parent, "Git index parent");
  if (backup.kind === "missing") {
    const existing = await lstat(backup.path).catch((error: unknown) => {
      if (isErrno(error, "ENOENT")) return null;
      throw filesystemError(error, "Git index is not accessible during rollback");
    });
    if (existing !== null) {
      if (existing.isSymbolicLink() || !existing.isFile()) {
        throw invalid("Git index changed to an unsafe file during rollback");
      }
      await unlink(backup.path);
    }
    await syncDirectory(backup.parent);
    return;
  }

  const temporary = join(backup.parent.path, `.index.${randomUUID()}.changelist-rollback`);
  let handle;
  let identity: FileIdentity | null = null;
  try {
    handle = await open(
      temporary,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      backup.mode,
    );
    await handle.writeFile(backup.bytes);
    await handle.sync();
    const metadata = await handle.stat();
    if (!metadata.isFile()) throw invalid("Rollback index is not a regular file");
    identity = fileIdentity(metadata);
    await handle.close();
    handle = null;
    await chmod(temporary, backup.mode);
    await assertPinnedDirectory(backup.parent, "Git index parent");
    const temporaryMetadata = await lstat(temporary);
    if (
      temporaryMetadata.isSymbolicLink() ||
      !temporaryMetadata.isFile() ||
      !sameIdentity(temporaryMetadata, identity)
    ) {
      throw invalid("Rollback index changed before it could be restored");
    }
    const destination = await lstat(backup.path).catch((error: unknown) => {
      if (isErrno(error, "ENOENT")) return null;
      throw filesystemError(error, "Git index is not accessible during rollback");
    });
    if (destination !== null && (destination.isSymbolicLink() || !destination.isFile())) {
      throw invalid("Git index changed to an unsafe file during rollback");
    }
    await rename(temporary, backup.path);
    identity = null;
    await syncDirectory(backup.parent);
  } finally {
    if (handle !== undefined && handle !== null) {
      await handle.close().catch(() => undefined);
    }
    if (identity !== null) {
      const metadata = await lstat(temporary).catch(() => null);
      if (
        metadata !== null &&
        metadata.isFile() &&
        !metadata.isSymbolicLink() &&
        sameIdentity(metadata, identity)
      ) {
        await unlink(temporary).catch(() => undefined);
      }
    }
  }
}

function selectedPath(path: string, selected: ReadonlySet<string>): boolean {
  for (const candidate of selected) {
    if (path === candidate || path.startsWith(`${candidate}${sep}`)) return true;
  }
  return false;
}

function parseIndexEntries(bytes: Buffer, paths: readonly string[]): ReadonlyMap<string, string> {
  if (!isUtf8(bytes)) throw invalid("Git returned non-UTF-8 index paths");
  const selected = new Set(paths);
  const entries = new Map<string, string>();
  for (const record of bytes.toString("utf8").split("\0")) {
    if (record.length === 0) continue;
    const separator = record.indexOf("\t");
    if (separator < 0) throw invalid("Git returned an invalid index record");
    const path = record.slice(separator + 1);
    normalizedPath(path);
    if (selectedPath(path, selected)) continue;
    const key = `${path}\0${record.slice(0, separator)}`;
    if (entries.has(key)) throw invalid("Git returned a duplicate index record");
    entries.set(key, record);
  }
  return entries;
}

function equalEntries(
  left: ReadonlyMap<string, string>,
  right: ReadonlyMap<string, string>,
): boolean {
  if (left.size !== right.size) return false;
  for (const [path, value] of left) {
    if (right.get(path) !== value) return false;
  }
  return true;
}

function parseNulPaths(bytes: Buffer): readonly string[] {
  if (!isUtf8(bytes)) throw invalid("Git returned non-UTF-8 untracked paths");
  const paths = bytes
    .toString("utf8")
    .split("\0")
    .filter((path) => path.length > 0)
    .map(normalizedPath);
  if (paths.length > MAX_CHANGELIST_PATHS) {
    throw new GitUtilityError("outputLimit", "Too many untracked changelist paths");
  }
  return Object.freeze([...new Set(paths)].sort(compareUtf8));
}

function parsedObjectId(bytes: Buffer, label: string): string {
  const value = decodedGitText(bytes, label);
  const result = ObjectIdSchema.safeParse(value);
  if (!result.success) throw invalid(`Git returned an invalid object id for ${label}`);
  return result.data;
}

async function captureHead(
  runner: PatchProcessRunnerLike,
  repository: RepositoryRecord,
  signal: AbortSignal | undefined,
): Promise<OriginalHead> {
  const [head, symbolicRef] = await Promise.all([
    captureOptionalGit(runner, repository, ["rev-parse", "--verify", "--quiet", "HEAD"], signal),
    captureOptionalGit(runner, repository, ["symbolic-ref", "--quiet", "HEAD"], signal),
  ]);
  return {
    oid: head.kind === "missing" ? null : parsedObjectId(head.bytes, "HEAD"),
    symbolicRef:
      symbolicRef.kind === "missing"
        ? null
        : decodedGitText(symbolicRef.bytes, "the symbolic HEAD"),
  };
}

async function rollbackHead(
  runner: PatchProcessRunnerLike,
  repository: RepositoryRecord,
  original: OriginalHead,
): Promise<void> {
  const current = await captureHead(runner, repository, undefined);
  if (current.oid === original.oid) return;
  if (current.oid === null) {
    throw new GitUtilityError("commandFailed", "Committed changelist disappeared before rollback");
  }
  let args: readonly string[];
  if (original.symbolicRef !== null) {
    args =
      original.oid === null
        ? ["update-ref", "--delete", original.symbolicRef, current.oid]
        : [
            "update-ref",
            "-m",
            "changelist transaction rollback",
            original.symbolicRef,
            original.oid,
            current.oid,
          ];
  } else if (original.oid !== null) {
    args = [
      "update-ref",
      "-m",
      "changelist transaction rollback",
      "HEAD",
      original.oid,
      current.oid,
    ];
  } else {
    throw new GitUtilityError(
      "commandFailed",
      "Cannot roll back an initial detached changelist commit",
    );
  }
  const outcome = await gitOutcome(runner, repository, args, undefined);
  if (outcome.kind !== "completed") throw processFailure(outcome);
}

async function rollbackTransaction(
  runner: PatchProcessRunnerLike,
  repository: RepositoryRecord,
  originalHead: OriginalHead,
  indexBackup: IndexBackup,
  originalError: unknown,
): Promise<never> {
  const rollbackErrors: string[] = [];
  await rollbackHead(runner, repository, originalHead).catch((error: unknown) => {
    rollbackErrors.push(
      error instanceof Error ? safeErrorMessage(error.message) : "HEAD rollback failed",
    );
  });
  await restoreIndex(indexBackup).catch((error: unknown) => {
    rollbackErrors.push(
      error instanceof Error ? safeErrorMessage(error.message) : "index rollback failed",
    );
  });
  if (rollbackErrors.length > 0) {
    throw new GitUtilityError(
      "commandFailed",
      `Changelist transaction failed and could not be rolled back safely: ${rollbackErrors.join("; ")}`,
    );
  }
  throw originalError;
}

class RepositoryMutex {
  readonly #tails = new Map<RepositoryId, Promise<void>>();

  async run<T>(
    repositoryId: RepositoryId,
    signal: AbortSignal | undefined,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.#tails.get(repositoryId) ?? Promise.resolve();
    let release = (): void => undefined;
    const current = new Promise<void>((resolveCurrent) => {
      release = resolveCurrent;
    });
    const tail = previous.catch(() => undefined).then(() => current);
    this.#tails.set(repositoryId, tail);
    await previous.catch(() => undefined);
    try {
      assertNotAborted(signal);
      return await operation();
    } finally {
      release();
      if (this.#tails.get(repositoryId) === tail) this.#tails.delete(repositoryId);
    }
  }
}

export class ChangelistService {
  readonly #registry: ChangelistRepositoryRegistryLike;
  readonly #storageRoot: string;
  readonly #runner: PatchProcessRunnerLike;
  readonly #mutex = new RepositoryMutex();

  private constructor(
    registry: ChangelistRepositoryRegistryLike,
    storageRoot: string,
    runner: PatchProcessRunnerLike,
  ) {
    if (
      typeof storageRoot !== "string" ||
      storageRoot.length === 0 ||
      storageRoot.length > 16_384 ||
      storageRoot.includes("\0") ||
      !isAbsolute(storageRoot)
    ) {
      throw invalid("Changelist storage root must be an absolute path");
    }
    this.#registry = registry;
    this.#storageRoot = storageRoot;
    this.#runner = runner;
  }

  static of(
    registry: ChangelistRepositoryRegistryLike,
    storageRoot: string,
    runner: PatchProcessRunnerLike = new PatchProcessRunner(),
  ): ChangelistService {
    return new ChangelistService(registry, storageRoot, runner);
  }

  async list(repositoryId: RepositoryId, signal?: AbortSignal): Promise<readonly Changelist[]> {
    const validatedRepositoryId = validateRepositoryId(repositoryId);
    return this.#mutex.run(validatedRepositoryId, signal, async () => {
      this.#repository(validatedRepositoryId);
      const manifest = await this.#readManifest(validatedRepositoryId, false);
      const entries = manifest.changelists.map(cloneChangelist);
      entries.sort((left, right) => left.createdAtMs - right.createdAtMs);
      return Object.freeze(entries);
    });
  }

  async save(
    repositoryId: RepositoryId,
    id: string | null,
    name: string,
    paths: readonly string[],
    signal?: AbortSignal,
  ): Promise<Changelist> {
    const validatedRepositoryId = validateRepositoryId(repositoryId);
    const input = validateSaveInput(id, name, paths);
    return this.#mutex.run(validatedRepositoryId, signal, async () => {
      this.#repository(validatedRepositoryId);
      const manifest = await this.#readManifest(validatedRepositoryId, true);
      const now = Date.now();
      let saved: Changelist;
      let changelists: Changelist[];
      if (input.id === null) {
        if (manifest.changelists.length >= MAX_CHANGELISTS) {
          throw new GitUtilityError(
            "outputLimit",
            `A repository cannot contain more than ${MAX_CHANGELISTS} changelists`,
          );
        }
        saved = {
          id: randomUUID(),
          repositoryId: validatedRepositoryId,
          name: input.name,
          paths: [...input.paths],
          createdAtMs: now,
          updatedAtMs: now,
        };
        changelists = [...manifest.changelists.map(cloneChangelist), saved];
      } else {
        const index = manifest.changelists.findIndex((entry) => entry.id === input.id);
        if (index < 0) throw invalid("Changelist does not exist");
        const existing = manifest.changelists[index];
        if (existing === undefined) throw invalid("Changelist does not exist");
        const updatedAtMs = Math.max(now, existing.createdAtMs, existing.updatedAtMs);
        saved = {
          ...existing,
          name: input.name,
          paths: [...input.paths],
          updatedAtMs,
        };
        changelists = manifest.changelists.map((entry, entryIndex) =>
          entryIndex === index ? saved : cloneChangelist(entry),
        );
      }
      await this.#writeManifest(
        {
          version: MANIFEST_VERSION,
          repositoryId: validatedRepositoryId,
          changelists,
        },
        signal,
      );
      return cloneChangelist(saved);
    });
  }

  async delete(
    repositoryId: RepositoryId,
    changelistId: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const validatedRepositoryId = validateRepositoryId(repositoryId);
    const validatedChangelistId = validateChangelistId(changelistId);
    await this.#mutex.run(validatedRepositoryId, signal, async () => {
      this.#repository(validatedRepositoryId);
      const manifest = await this.#readManifest(validatedRepositoryId, true);
      await this.#writeManifest(
        {
          ...manifest,
          changelists: manifest.changelists
            .filter((entry) => entry.id !== validatedChangelistId)
            .map(cloneChangelist),
        },
        signal,
      );
    });
  }

  async commit(
    repositoryId: RepositoryId,
    changelistId: string,
    options: ChangelistCommitOptions,
    signal?: AbortSignal,
  ): Promise<ChangelistCommitResult> {
    const validatedRepositoryId = validateRepositoryId(repositoryId);
    const validatedChangelistId = validateChangelistId(changelistId);
    const validatedOptions = validateCommitOptions(options);
    return this.#mutex.run(validatedRepositoryId, signal, async () => {
      const repository = this.#repository(validatedRepositoryId);
      const repositoryRoot = await pinRepository(repository);
      const manifest = await this.#readManifest(validatedRepositoryId, true);
      const changelist = manifest.changelists.find((entry) => entry.id === validatedChangelistId);
      if (changelist === undefined) throw invalid("Changelist does not exist");
      if (changelist.paths.length === 0) throw invalid("Changelist has no files");

      const originalHead = await captureHead(this.#runner, repository, signal);
      const indexBackup = await backupIndex(this.#runner, repository, signal);
      const unselectedBefore = parseIndexEntries(
        await captureGit(this.#runner, repository, ["ls-files", "--stage", "-z"], signal),
        changelist.paths,
      );

      try {
        const untracked = parseNulPaths(
          await captureGit(
            this.#runner,
            repository,
            ["ls-files", "--others", "--exclude-standard", "-z", "--", ...changelist.paths],
            signal,
          ),
        );
        if (untracked.length > 0) {
          await captureGit(
            this.#runner,
            repository,
            ["add", "--intent-to-add", "--", ...untracked],
            signal,
            MAX_GIT_DIAGNOSTIC_BYTES,
          );
        }
        const arguments_: string[] = ["commit", "--only", "--message", validatedOptions.message];
        if (validatedOptions.amend) arguments_.push("--amend");
        if (validatedOptions.signOff) arguments_.push("--signoff");
        if (validatedOptions.gpgSign) arguments_.push("--gpg-sign");
        arguments_.push("--", ...changelist.paths);
        await captureGit(this.#runner, repository, arguments_, signal, MAX_GIT_DIAGNOSTIC_BYTES);
        assertNotAborted(signal);
        await assertPinnedDirectory(repositoryRoot, "Repository root");
        const commitOid = parsedObjectId(
          await captureGit(
            this.#runner,
            repository,
            ["rev-parse", "--verify", "HEAD"],
            signal,
            64 * 1024,
          ),
          "the changelist commit",
        );
        const unselectedAfter = parseIndexEntries(
          await captureGit(this.#runner, repository, ["ls-files", "--stage", "-z"], signal),
          changelist.paths,
        );
        if (!equalEntries(unselectedBefore, unselectedAfter)) {
          throw new GitUtilityError(
            "commandFailed",
            "Selected changelist commit changed unrelated index entries",
          );
        }
        await this.#writeManifest(
          {
            ...manifest,
            changelists: manifest.changelists
              .filter((entry) => entry.id !== validatedChangelistId)
              .map(cloneChangelist),
          },
          signal,
        );
        return { changelistId: validatedChangelistId, commitOid };
      } catch (error) {
        return rollbackTransaction(this.#runner, repository, originalHead, indexBackup, error);
      }
    });
  }

  #repository(repositoryId: RepositoryId): RepositoryRecord {
    const repository = this.#registry.get(repositoryId);
    if (repository.id !== repositoryId) {
      throw new GitUtilityError("repositoryNotOpen", "Repository registry identity changed");
    }
    return repository;
  }

  async #manifestDirectory(create: boolean): Promise<PinnedDirectory | null> {
    const root = await ensureStorageRoot(this.#storageRoot);
    return create
      ? ensureChildDirectory(root, MANIFEST_DIRECTORY, "Changelist directory")
      : optionalChildDirectory(root, MANIFEST_DIRECTORY, "Changelist directory");
  }

  async #readManifest(
    repositoryId: RepositoryId,
    createDirectory: boolean,
  ): Promise<ManifestPayload> {
    const directory = await this.#manifestDirectory(createDirectory);
    if (directory === null) {
      return {
        version: MANIFEST_VERSION,
        repositoryId,
        changelists: [],
      };
    }
    const bytes = await readContainedFile(
      directory,
      `${repositoryId}.json`,
      MAX_CHANGELIST_MANIFEST_BYTES,
      "Changelist manifest",
    );
    if (bytes.kind === "missing") {
      return {
        version: MANIFEST_VERSION,
        repositoryId,
        changelists: [],
      };
    }
    if (!isUtf8(bytes.bytes)) {
      throw invalid("Changelist manifest must be UTF-8 JSON");
    }
    let decoded: unknown;
    try {
      decoded = JSON.parse(bytes.bytes.toString("utf8")) as unknown;
    } catch {
      throw invalid("Changelist manifest is not valid JSON");
    }
    return validatePayload(decoded, repositoryId);
  }

  async #writeManifest(payload: ManifestPayload, signal: AbortSignal | undefined): Promise<void> {
    const directory = await this.#manifestDirectory(true);
    if (directory === null) throw invalid("Unable to create changelist directory");
    const bytes = encodedManifest(clonePayload(payload));
    await atomicWriteContainedFile(directory, `${payload.repositoryId}.json`, bytes, signal);
    const persisted = await this.#readManifest(payload.repositoryId, false);
    if (checksum(payloadBytes(persisted)) !== checksum(payloadBytes(payload))) {
      throw invalid("Changelist manifest failed semantic verification");
    }
  }
}
