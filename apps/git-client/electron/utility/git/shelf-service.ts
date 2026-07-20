import { Buffer, isUtf8 } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import type { Stats } from "node:fs";
import { lstat, mkdir, open, readdir, realpath, rename, rm, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, sep } from "node:path";
import { z } from "zod";
import type { RepositoryId, RepositoryRecord } from "../../../src/shared/contracts/git-utility";
import type { ShelfEntry, ShelfFile } from "../../../src/shared/contracts/model";
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

export const MAX_SHELF_PATCH_BYTES = 20 * 1024 * 1024;
export const MAX_SHELF_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_SHELF_TOTAL_BYTES = 100 * 1024 * 1024;
export const MAX_SHELF_PATHS = 10_000;

const MAX_SHELF_MESSAGE_BYTES = 1024 * 1024;
const MAX_SHELF_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_SHELF_PATH_OUTPUT_BYTES = 16 * 1024 * 1024;
const MAX_SHELF_DIAGNOSTIC_BYTES = 1024 * 1024;
const MANIFEST_FILE = "manifest.json";
const INDEX_PATCH_FILE = "index.patch";
const WORKTREE_PATCH_FILE = "worktree.patch";
const UNTRACKED_DIRECTORY = "untracked";

const UuidSchema = z.uuid();
const ChecksumSchema = z.string().regex(/^[0-9a-f]{64}$/u);
const ShelfFileSchema = z
  .object({
    path: z.string().min(1).max(16_384),
    checksum: z.string().max(64),
    untracked: z.boolean(),
  })
  .strict();
const ShelfEntrySchema = z
  .object({
    id: UuidSchema,
    repositoryId: UuidSchema,
    message: z.string().max(MAX_SHELF_MESSAGE_BYTES),
    createdAtMs: z.number().int().nonnegative().safe(),
    files: z.array(ShelfFileSchema).max(MAX_SHELF_PATHS),
    indexPatchChecksum: ChecksumSchema,
    worktreePatchChecksum: ChecksumSchema,
  })
  .strict();
const ShelfManifestSchema = z.object({ entry: ShelfEntrySchema }).strict();

export interface ShelfRepositoryRegistryLike {
  get(repositoryId: RepositoryId): RepositoryRecord;
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

interface ReadFileResult {
  readonly bytes: Buffer;
  readonly identity: FileIdentity;
}

interface CapturedUntrackedFile extends ReadFileResult {
  readonly path: string;
  readonly checksum: string;
}

interface VerifiedShelf {
  readonly directory: PinnedDirectory;
  readonly entry: ShelfEntry;
  readonly indexPatch: Buffer;
  readonly worktreePatch: Buffer;
  readonly untracked: ReadonlyMap<string, Buffer>;
}

interface CreateInput {
  readonly message: string;
  readonly paths: readonly string[];
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

function sameIdentity(metadata: Stats, pinned: PinnedDirectory | FileIdentity): boolean {
  return metadata.dev === pinned.device && metadata.ino === pinned.inode;
}

function directoryFrom(path: string, metadata: Stats): PinnedDirectory {
  return { path, device: metadata.dev, inode: metadata.ino };
}

function fileIdentity(metadata: Stats): FileIdentity {
  return { device: metadata.dev, inode: metadata.ino, size: metadata.size };
}

function checksum(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted !== true) return;
  const suffix = signal.reason === "repositoryClosed" ? " because the repository closed" : "";
  throw new GitUtilityError("commandFailed", `Shelf command cancelled${suffix}`);
}

function validateShelfId(untrustedShelfId: unknown): string {
  const result = UuidSchema.safeParse(untrustedShelfId);
  if (!result.success) throw invalid("Shelf id must be a UUID");
  return result.data;
}

function validateRepositoryId(untrustedRepositoryId: unknown): RepositoryId {
  const result = UuidSchema.safeParse(untrustedRepositoryId);
  if (!result.success) throw invalid("Repository id must be a UUID");
  return result.data as RepositoryId;
}

function pathComponents(untrustedPath: unknown): readonly string[] {
  if (typeof untrustedPath !== "string") throw invalid("Every shelf path must be a string");
  validateRelativePath(untrustedPath);
  const normalized = normalize(untrustedPath);
  const components = untrustedPath.split(sep);
  if (
    normalized !== untrustedPath ||
    components.some(
      (component) => component.length === 0 || component === "." || component === "..",
    )
  ) {
    throw invalid("Shelf paths must be normalized relative paths");
  }
  return Object.freeze(components);
}

function validateCreateInput(untrustedMessage: unknown, untrustedPaths: unknown): CreateInput {
  if (typeof untrustedMessage !== "string") throw invalid("Shelf message must be a string");
  if (
    untrustedMessage.includes("\0") ||
    Buffer.byteLength(untrustedMessage, "utf8") > MAX_SHELF_MESSAGE_BYTES
  ) {
    throw invalid("Shelf message must not contain NUL or exceed 1 MiB");
  }
  if (
    !Array.isArray(untrustedPaths) ||
    untrustedPaths.length < 1 ||
    untrustedPaths.length > MAX_SHELF_PATHS
  ) {
    throw invalid(`Shelf paths must contain 1 to ${MAX_SHELF_PATHS} entries`);
  }
  const paths: string[] = [];
  const seen = new Set<string>();
  for (const untrustedPath of untrustedPaths) {
    pathComponents(untrustedPath);
    const path = untrustedPath as string;
    if (!seen.has(path)) {
      seen.add(path);
      paths.push(path);
    }
  }
  return {
    message: untrustedMessage.trim().length === 0 ? "Shelved changes" : untrustedMessage,
    paths: Object.freeze(paths),
  };
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
  if (!canonicalMetadata.isDirectory() || canonicalMetadata.isSymbolicLink()) {
    throw invalid(`${label} must remain a real directory`);
  }
  return directoryFrom(canonical, canonicalMetadata);
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
  await assertPinnedDirectory(parent, "Shelf parent directory");
  const candidate = join(parent.path, name);
  let metadata: Stats;
  try {
    metadata = await lstat(candidate);
  } catch (error) {
    if (isErrno(error, "ENOENT")) return null;
    throw filesystemError(error, `${label} is not accessible`);
  }
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw invalid(`${label} must be a real directory, not a symbolic link`);
  }
  const child = await pinDirectory(candidate, label);
  if (dirname(child.path) !== parent.path) throw invalid(`${label} must stay inside its parent`);
  await assertPinnedDirectory(parent, "Shelf parent directory");
  return child;
}

async function ensureChildDirectory(
  parent: PinnedDirectory,
  name: string,
  label: string,
): Promise<PinnedDirectory> {
  const existing = await optionalChildDirectory(parent, name, label);
  if (existing !== null) return existing;
  await assertPinnedDirectory(parent, "Shelf parent directory");
  try {
    await mkdir(join(parent.path, name), { mode: 0o700 });
  } catch (error) {
    if (!isErrno(error, "EEXIST")) throw filesystemError(error, `Unable to create ${label}`);
  }
  const child = await optionalChildDirectory(parent, name, label);
  if (child === null) throw invalid(`${label} disappeared while it was being created`);
  return child;
}

async function pinRepository(repository: RepositoryRecord): Promise<PinnedDirectory> {
  if (repository.isBare) throw invalid("Shelves require a working tree");
  const pinned = await pinDirectory(repository.path, "Repository root");
  if (pinned.path !== repository.path) {
    throw new GitUtilityError("repositoryNotOpen", "Canonical repository path changed");
  }
  return pinned;
}

async function walkExistingParent(
  root: PinnedDirectory,
  components: readonly string[],
  label: string,
): Promise<PinnedDirectory> {
  let current = root;
  for (const component of components) {
    const child = await optionalChildDirectory(current, component, label);
    if (child === null) throw invalid(`${label} is missing`);
    current = child;
  }
  return current;
}

async function ensureParent(
  root: PinnedDirectory,
  components: readonly string[],
  label: string,
): Promise<PinnedDirectory> {
  let current = root;
  for (const component of components) {
    current = await ensureChildDirectory(current, component, label);
  }
  return current;
}

async function readContainedFile(
  root: PinnedDirectory,
  relativePath: string,
  maximumBytes: number,
  label: string,
): Promise<ReadFileResult> {
  const components = pathComponents(relativePath);
  const parent = await walkExistingParent(root, components.slice(0, -1), label);
  const path = join(parent.path, components.at(-1) as string);
  let before: Stats;
  try {
    before = await lstat(path);
  } catch (error) {
    throw filesystemError(error, `${label} is not accessible`);
  }
  if (before.isSymbolicLink() || !before.isFile()) {
    throw invalid(`${label} must be a regular file, not a symbolic link`);
  }
  if (before.size > maximumBytes) throw new GitUtilityError("outputLimit", `${label} is too large`);
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    throw invalid(
      `${label} could not be opened without following a symbolic link (${safeErrorMessage(error instanceof Error ? error.message : "open failed")})`,
    );
  }
  try {
    const opened = await handle.stat();
    if (!opened.isFile() || !sameIdentity(opened, fileIdentity(before))) {
      throw invalid(`${label} changed before it could be read`);
    }
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, maximumBytes - total + 1));
      const { bytesRead } = await handle.read(chunk, 0, chunk.byteLength, null);
      if (bytesRead === 0) break;
      chunks.push(Buffer.from(chunk.subarray(0, bytesRead)));
      total += bytesRead;
      if (total > maximumBytes) throw new GitUtilityError("outputLimit", `${label} is too large`);
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
    return { bytes: Buffer.concat(chunks, total), identity: fileIdentity(opened) };
  } finally {
    await handle.close().catch(() => undefined);
  }
}

async function writeContainedFile(
  root: PinnedDirectory,
  relativePath: string,
  bytes: Buffer,
  label: string,
  mode = 0o600,
): Promise<FileIdentity> {
  const components = pathComponents(relativePath);
  const parent = await ensureParent(root, components.slice(0, -1), `${label} parent`);
  const path = join(parent.path, components.at(-1) as string);
  let handle;
  try {
    handle = await open(
      path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      mode,
    );
  } catch (error) {
    throw invalid(
      `${label} could not be created safely (${safeErrorMessage(error instanceof Error ? error.message : "open failed")})`,
    );
  }
  let identity: FileIdentity;
  try {
    await handle.writeFile(bytes);
    await handle.sync();
    const metadata = await handle.stat();
    if (!metadata.isFile()) throw invalid(`${label} did not remain a regular file`);
    identity = fileIdentity(metadata);
  } finally {
    await handle.close().catch(() => undefined);
  }
  const finalMetadata = await lstat(path).catch(() => null);
  if (
    finalMetadata === null ||
    finalMetadata.isSymbolicLink() ||
    !finalMetadata.isFile() ||
    !sameIdentity(finalMetadata, identity)
  ) {
    throw invalid(`${label} changed while it was being written`);
  }
  await assertPinnedDirectory(parent, `${label} parent`);
  return identity;
}

async function syncDirectory(directory: PinnedDirectory): Promise<void> {
  await assertPinnedDirectory(directory, "Shelf directory");
  const handle = await open(directory.path, constants.O_RDONLY).catch((error: unknown) => {
    throw filesystemError(error, "Shelf directory could not be opened for synchronization");
  });
  try {
    await handle.sync().catch((error: unknown) => {
      throw filesystemError(error, "Shelf directory could not be synchronized");
    });
  } finally {
    await handle.close().catch(() => undefined);
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
    return new GitUtilityError("commandFailed", `Shelf command${suffix}`);
  }
  const detail = outcome.stderr.byteLength > 0 ? outcome.stderr.toString("utf8") : outcome.message;
  return new GitUtilityError(outcome.code, safeErrorMessage(detail), outcome.exitCode);
}

async function captureGit(
  runner: PatchProcessRunnerLike,
  cwd: string,
  args: readonly string[],
  maximumBytes: number,
  signal: AbortSignal | undefined,
): Promise<Buffer> {
  assertNotAborted(signal);
  const outcome = await runner.run(
    {
      cwd,
      args,
      timeoutMs: PATCH_COMMAND_TIMEOUT_MS,
      stdoutLimitBytes: maximumBytes + 1,
      stderrLimitBytes: MAX_SHELF_DIAGNOSTIC_BYTES,
    },
    signal,
  );
  if (outcome.kind !== "completed") throw processFailure(outcome);
  if (outcome.stdout.byteLength > maximumBytes) {
    throw new GitUtilityError("outputLimit", "Shelf Git output exceeded its configured limit");
  }
  return outcome.stdout;
}

async function runGit(
  runner: PatchProcessRunnerLike,
  cwd: string,
  args: readonly string[],
  signal: AbortSignal | undefined,
  stdin?: Buffer,
): Promise<void> {
  assertNotAborted(signal);
  const outcome = await runner.run(
    {
      cwd,
      args,
      ...(stdin === undefined ? {} : { stdin }),
      timeoutMs: PATCH_COMMAND_TIMEOUT_MS,
      stdoutLimitBytes: MAX_SHELF_DIAGNOSTIC_BYTES,
      stderrLimitBytes: MAX_SHELF_DIAGNOSTIC_BYTES,
    },
    signal,
  );
  if (outcome.kind !== "completed") throw processFailure(outcome);
}

function parseUntrackedPaths(bytes: Buffer): readonly string[] {
  if (!isUtf8(bytes)) throw invalid("Git returned a non-UTF-8 untracked path");
  const paths = bytes
    .toString("utf8")
    .split("\0")
    .filter((path) => path.length > 0);
  if (paths.length > MAX_SHELF_PATHS) {
    throw new GitUtilityError("outputLimit", `Shelf contains more than ${MAX_SHELF_PATHS} paths`);
  }
  const unique = new Set<string>();
  for (const path of paths) {
    pathComponents(path);
    unique.add(path);
  }
  return Object.freeze([...unique].sort());
}

function validateManifestEntry(
  untrusted: unknown,
  repositoryId: RepositoryId,
  shelfId: string,
): ShelfEntry {
  const parsed = ShelfManifestSchema.safeParse(untrusted);
  if (!parsed.success) throw invalid("Shelf manifest is invalid");
  const entry = parsed.data.entry;
  if (entry.id !== shelfId || entry.repositoryId !== repositoryId) {
    throw invalid("Shelf manifest identity does not match its directory");
  }
  if (
    entry.message.includes("\0") ||
    Buffer.byteLength(entry.message, "utf8") > MAX_SHELF_MESSAGE_BYTES
  ) {
    throw invalid("Shelf manifest message is invalid");
  }
  const seen = new Set<string>();
  for (const file of entry.files) {
    pathComponents(file.path);
    if (seen.has(file.path)) throw invalid("Shelf manifest contains duplicate paths");
    seen.add(file.path);
    if (file.untracked) {
      if (!ChecksumSchema.safeParse(file.checksum).success) {
        throw invalid(`Shelf checksum is invalid for ${file.path}`);
      }
    } else if (file.checksum !== "") {
      throw invalid(`Tracked shelf path must not contain a file checksum (${file.path})`);
    }
  }
  return {
    ...entry,
    repositoryId: entry.repositoryId as RepositoryId,
    files: entry.files.map((file) => ({ ...file })),
  };
}

async function verifyShelf(
  parent: PinnedDirectory,
  repositoryId: RepositoryId,
  shelfId: string,
  directoryName = shelfId,
): Promise<VerifiedShelf> {
  const directory = await optionalChildDirectory(parent, directoryName, "Shelf directory");
  if (directory === null) throw invalid("Shelf does not exist");
  const manifestFile = await readContainedFile(
    directory,
    MANIFEST_FILE,
    MAX_SHELF_MANIFEST_BYTES,
    "Shelf manifest",
  );
  if (!isUtf8(manifestFile.bytes)) throw invalid("Shelf manifest must contain valid UTF-8");
  let decoded: unknown;
  try {
    decoded = JSON.parse(manifestFile.bytes.toString("utf8")) as unknown;
  } catch {
    throw invalid("Shelf manifest is not valid JSON");
  }
  const entry = validateManifestEntry(decoded, repositoryId, shelfId);
  const indexPatch = (
    await readContainedFile(directory, INDEX_PATCH_FILE, MAX_SHELF_PATCH_BYTES, "Shelf index patch")
  ).bytes;
  const worktreePatch = (
    await readContainedFile(
      directory,
      WORKTREE_PATCH_FILE,
      MAX_SHELF_PATCH_BYTES,
      "Shelf worktree patch",
    )
  ).bytes;
  if (
    checksum(indexPatch) !== entry.indexPatchChecksum ||
    checksum(worktreePatch) !== entry.worktreePatchChecksum
  ) {
    throw invalid("Shelf patch checksum mismatch");
  }
  let totalBytes = manifestFile.bytes.byteLength + indexPatch.byteLength + worktreePatch.byteLength;
  const untracked = new Map<string, Buffer>();
  for (const file of entry.files) {
    if (!file.untracked) continue;
    const stored = await readContainedFile(
      directory,
      join(UNTRACKED_DIRECTORY, file.path),
      MAX_SHELF_FILE_BYTES,
      `Shelved file ${file.path}`,
    );
    if (checksum(stored.bytes) !== file.checksum) {
      throw invalid(`Shelf checksum mismatch for ${file.path}`);
    }
    totalBytes += stored.bytes.byteLength;
    if (totalBytes > MAX_SHELF_TOTAL_BYTES) {
      throw new GitUtilityError("outputLimit", "Shelf exceeds the 100 MiB total limit");
    }
    untracked.set(file.path, stored.bytes);
  }
  await assertPinnedDirectory(directory, "Shelf directory");
  return { directory, entry, indexPatch, worktreePatch, untracked };
}

async function removePinnedDirectory(
  parent: PinnedDirectory,
  directory: PinnedDirectory,
): Promise<void> {
  await assertPinnedDirectory(parent, "Shelf parent directory");
  await assertPinnedDirectory(directory, "Shelf directory");
  if (dirname(directory.path) !== parent.path) throw invalid("Shelf directory escaped its parent");
  await rm(directory.path, { recursive: true, force: false }).catch((error: unknown) => {
    throw filesystemError(error, "Shelf directory could not be removed");
  });
  await syncDirectory(parent);
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

export class ShelfService {
  readonly #registry: ShelfRepositoryRegistryLike;
  readonly #storageRoot: string;
  readonly #runner: PatchProcessRunnerLike;
  readonly #mutex = new RepositoryMutex();

  constructor(
    registry: ShelfRepositoryRegistryLike,
    storageRoot: string,
    runner: PatchProcessRunnerLike = new PatchProcessRunner(),
  ) {
    if (
      typeof storageRoot !== "string" ||
      storageRoot.length < 1 ||
      storageRoot.length > 16_384 ||
      storageRoot.includes("\0") ||
      !isAbsolute(storageRoot)
    ) {
      throw invalid("Shelf storage root must be an absolute path");
    }
    this.#registry = registry;
    this.#storageRoot = storageRoot;
    this.#runner = runner;
  }

  static of(
    registry: ShelfRepositoryRegistryLike,
    storageRoot: string,
    runner: PatchProcessRunnerLike = new PatchProcessRunner(),
  ): ShelfService {
    return new ShelfService(registry, storageRoot, runner);
  }

  async create(
    repositoryId: RepositoryId,
    untrustedMessage: unknown,
    untrustedPaths: unknown,
    signal?: AbortSignal,
  ): Promise<ShelfEntry> {
    const input = validateCreateInput(untrustedMessage, untrustedPaths);
    const validatedRepositoryId = validateRepositoryId(repositoryId);
    return this.#mutex.run(validatedRepositoryId, async () => {
      assertNotAborted(signal);
      const repository = this.#repository(validatedRepositoryId);
      const repositoryRoot = await pinRepository(repository);
      const shelves = await this.#repositoryShelves(validatedRepositoryId, true);
      if (shelves === null) throw invalid("Unable to create shelf storage");
      const shelfId = randomUUID();
      const temporaryName = `.${shelfId}.tmp`;
      const temporaryPath = join(shelves.path, temporaryName);
      await mkdir(temporaryPath, { mode: 0o700 }).catch((error: unknown) => {
        throw filesystemError(error, "Unable to create temporary shelf");
      });
      const temporary = await optionalChildDirectory(shelves, temporaryName, "Temporary shelf");
      if (temporary === null) throw invalid("Temporary shelf disappeared");
      let committed = false;
      try {
        const indexPatch = await captureGit(
          this.#runner,
          repository.path,
          ["diff", "--binary", "--full-index", "--no-color", "--cached", "--", ...input.paths],
          MAX_SHELF_PATCH_BYTES,
          signal,
        );
        const worktreePatch = await captureGit(
          this.#runner,
          repository.path,
          ["diff", "--binary", "--full-index", "--no-color", "--", ...input.paths],
          MAX_SHELF_PATCH_BYTES,
          signal,
        );
        const untrackedOutput = await captureGit(
          this.#runner,
          repository.path,
          ["ls-files", "--others", "--exclude-standard", "-z", "--", ...input.paths],
          MAX_SHELF_PATH_OUTPUT_BYTES,
          signal,
        );
        const untrackedPaths = parseUntrackedPaths(untrackedOutput);
        const untrackedSet = new Set(untrackedPaths);
        let totalBytes = indexPatch.byteLength + worktreePatch.byteLength;
        if (totalBytes > MAX_SHELF_TOTAL_BYTES) {
          throw new GitUtilityError("outputLimit", "Shelf exceeds the 100 MiB total limit");
        }
        await writeContainedFile(temporary, INDEX_PATCH_FILE, indexPatch, "Shelf index patch");
        await writeContainedFile(
          temporary,
          WORKTREE_PATCH_FILE,
          worktreePatch,
          "Shelf worktree patch",
        );
        const captured = new Map<string, CapturedUntrackedFile>();
        for (const path of untrackedPaths) {
          assertNotAborted(signal);
          const source = await readContainedFile(
            repositoryRoot,
            path,
            MAX_SHELF_FILE_BYTES,
            `Untracked file ${path}`,
          );
          totalBytes += source.bytes.byteLength;
          if (totalBytes > MAX_SHELF_TOTAL_BYTES) {
            throw new GitUtilityError("outputLimit", "Shelf exceeds the 100 MiB total limit");
          }
          const digest = checksum(source.bytes);
          await writeContainedFile(
            temporary,
            join(UNTRACKED_DIRECTORY, path),
            source.bytes,
            `Shelved file ${path}`,
          );
          captured.set(path, { ...source, path, checksum: digest });
        }
        const allPaths = [...new Set([...input.paths, ...untrackedPaths])].sort();
        if (allPaths.length > MAX_SHELF_PATHS) {
          throw new GitUtilityError(
            "outputLimit",
            `Shelf contains more than ${MAX_SHELF_PATHS} paths`,
          );
        }
        const files: ShelfFile[] = allPaths.map((path) => ({
          path,
          checksum: captured.get(path)?.checksum ?? "",
          untracked: untrackedSet.has(path),
        }));
        const entry: ShelfEntry = {
          id: shelfId,
          repositoryId: validatedRepositoryId,
          message: input.message,
          createdAtMs: Date.now(),
          files,
          indexPatchChecksum: checksum(indexPatch),
          worktreePatchChecksum: checksum(worktreePatch),
        };
        const manifest = Buffer.from(JSON.stringify({ entry }, null, 2), "utf8");
        if (manifest.byteLength > MAX_SHELF_MANIFEST_BYTES) {
          throw new GitUtilityError("outputLimit", "Shelf manifest exceeds 2 MiB");
        }
        await writeContainedFile(temporary, MANIFEST_FILE, manifest, "Shelf manifest");
        await syncDirectory(temporary);
        await verifyShelf(shelves, validatedRepositoryId, shelfId, temporaryName);
        const destination = join(shelves.path, shelfId);
        try {
          await lstat(destination);
          throw invalid("Shelf destination already exists");
        } catch (error) {
          if (!isErrno(error, "ENOENT")) throw error;
        }
        await assertPinnedDirectory(shelves, "Shelf repository directory");
        await assertPinnedDirectory(temporary, "Temporary shelf");
        await rename(temporary.path, destination);
        const directory = await optionalChildDirectory(shelves, shelfId, "Shelf directory");
        if (directory === null || !sameIdentity(await lstat(directory.path), temporary)) {
          throw invalid("Shelf directory changed while it was being committed");
        }
        committed = true;
        await syncDirectory(shelves);
        await verifyShelf(shelves, validatedRepositoryId, shelfId);
        await this.#removeShelvedChanges(repository, repositoryRoot, files, captured, signal);
        return entry;
      } catch (error) {
        if (!committed) {
          await removePinnedDirectory(shelves, temporary).catch(() => undefined);
        }
        throw filesystemError(error, "Unable to create shelf");
      }
    });
  }

  async list(repositoryId: RepositoryId): Promise<readonly ShelfEntry[]> {
    const validatedRepositoryId = validateRepositoryId(repositoryId);
    this.#repository(validatedRepositoryId);
    const shelves = await this.#repositoryShelves(validatedRepositoryId, false);
    if (shelves === null) return Object.freeze([]);
    const entries: ShelfEntry[] = [];
    const children = await readdir(shelves.path, { withFileTypes: true }).catch(
      (error: unknown) => {
        throw filesystemError(error, "Unable to list shelves");
      },
    );
    for (const child of children) {
      if (!child.isDirectory() || !UuidSchema.safeParse(child.name).success) continue;
      try {
        entries.push((await verifyShelf(shelves, validatedRepositoryId, child.name)).entry);
      } catch {
        // Rebased omits damaged shelf directories from list results; apply/delete still fail closed.
      }
    }
    entries.sort((left, right) => right.createdAtMs - left.createdAtMs);
    return Object.freeze(entries);
  }

  async apply(
    repositoryId: RepositoryId,
    untrustedShelfId: unknown,
    dropAfterApply: boolean,
    signal?: AbortSignal,
  ): Promise<void> {
    const shelfId = validateShelfId(untrustedShelfId);
    const validatedRepositoryId = validateRepositoryId(repositoryId);
    if (typeof dropAfterApply !== "boolean") throw invalid("dropAfterApply must be a boolean");
    await this.#mutex.run(validatedRepositoryId, async () => {
      assertNotAborted(signal);
      const repository = this.#repository(validatedRepositoryId);
      const repositoryRoot = await pinRepository(repository);
      const shelves = await this.#repositoryShelves(validatedRepositoryId, false);
      if (shelves === null) throw invalid("Shelf does not exist");
      const shelf = await verifyShelf(shelves, validatedRepositoryId, shelfId);
      for (const file of shelf.entry.files) {
        if (file.untracked) await this.#preflightDestination(repositoryRoot, file.path);
      }
      if (shelf.indexPatch.byteLength > 0) {
        await runGit(
          this.#runner,
          repository.path,
          ["apply", "--whitespace=nowarn", "--3way", "--index", "-"],
          signal,
          shelf.indexPatch,
        );
      }
      if (shelf.worktreePatch.byteLength > 0) {
        await runGit(
          this.#runner,
          repository.path,
          ["apply", "--whitespace=nowarn", "-"],
          signal,
          shelf.worktreePatch,
        );
      }
      for (const [path, bytes] of shelf.untracked) {
        assertNotAborted(signal);
        await writeContainedFile(
          repositoryRoot,
          path,
          bytes,
          `Restored untracked file ${path}`,
          0o644,
        );
      }
      if (dropAfterApply) await removePinnedDirectory(shelves, shelf.directory);
    });
  }

  async delete(repositoryId: RepositoryId, untrustedShelfId: unknown): Promise<void> {
    const shelfId = validateShelfId(untrustedShelfId);
    const validatedRepositoryId = validateRepositoryId(repositoryId);
    await this.#mutex.run(validatedRepositoryId, async () => {
      this.#repository(validatedRepositoryId);
      const shelves = await this.#repositoryShelves(validatedRepositoryId, false);
      if (shelves === null) return;
      const existing = await optionalChildDirectory(shelves, shelfId, "Shelf directory");
      if (existing === null) return;
      const shelf = await verifyShelf(shelves, validatedRepositoryId, shelfId);
      await removePinnedDirectory(shelves, shelf.directory);
    });
  }

  async #repositoryShelves(
    repositoryId: RepositoryId,
    create: boolean,
  ): Promise<PinnedDirectory | null> {
    const root = await pinDirectory(this.#storageRoot, "Shelf storage root");
    const shelves = create
      ? await ensureChildDirectory(root, "shelves", "Shelf storage directory")
      : await optionalChildDirectory(root, "shelves", "Shelf storage directory");
    if (shelves === null) return null;
    return create
      ? ensureChildDirectory(shelves, repositoryId, "Repository shelf directory")
      : optionalChildDirectory(shelves, repositoryId, "Repository shelf directory");
  }

  #repository(repositoryId: RepositoryId): RepositoryRecord {
    const repository = this.#registry.get(repositoryId);
    if (repository.id !== repositoryId) {
      throw new GitUtilityError("repositoryNotOpen", "Repository registry identity changed");
    }
    return repository;
  }

  async #removeShelvedChanges(
    repository: RepositoryRecord,
    repositoryRoot: PinnedDirectory,
    files: readonly ShelfFile[],
    captured: ReadonlyMap<string, CapturedUntrackedFile>,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    const tracked = files.filter((file) => !file.untracked).map((file) => file.path);
    if (tracked.length > 0) {
      await runGit(
        this.#runner,
        repository.path,
        ["restore", "--source=HEAD", "--staged", "--worktree", "--", ...tracked],
        signal,
      );
    }
    for (const stored of captured.values()) {
      assertNotAborted(signal);
      const current = await readContainedFile(
        repositoryRoot,
        stored.path,
        MAX_SHELF_FILE_BYTES,
        `Untracked file ${stored.path}`,
      );
      if (
        current.identity.device !== stored.identity.device ||
        current.identity.inode !== stored.identity.inode ||
        checksum(current.bytes) !== stored.checksum
      ) {
        throw invalid(`Untracked file changed while shelving (${stored.path})`);
      }
      const components = pathComponents(stored.path);
      const parent = await walkExistingParent(
        repositoryRoot,
        components.slice(0, -1),
        `Untracked file ${stored.path}`,
      );
      const path = join(parent.path, components.at(-1) as string);
      const metadata = await lstat(path).catch((error: unknown) => {
        throw filesystemError(error, `Untracked file is not accessible (${stored.path})`);
      });
      if (
        metadata.isSymbolicLink() ||
        !metadata.isFile() ||
        !sameIdentity(metadata, stored.identity)
      ) {
        throw invalid(`Untracked file changed while shelving (${stored.path})`);
      }
      await unlink(path).catch((error: unknown) => {
        throw filesystemError(error, `Untracked file could not be removed (${stored.path})`);
      });
      await assertPinnedDirectory(parent, `Untracked file parent ${stored.path}`);
    }
  }

  async #preflightDestination(repositoryRoot: PinnedDirectory, path: string): Promise<void> {
    const components = pathComponents(path);
    let current = repositoryRoot;
    for (const component of components.slice(0, -1)) {
      const child = await optionalChildDirectory(current, component, `Restore parent for ${path}`);
      if (child === null) return;
      current = child;
    }
    try {
      await lstat(join(current.path, components.at(-1) as string));
      throw invalid(`Cannot restore shelf because ${path} already exists`);
    } catch (error) {
      if (!isErrno(error, "ENOENT")) throw error;
    }
  }
}
