import { Buffer } from "node:buffer";
import { constants } from "node:fs";
import type { Stats } from "node:fs";
import { lstat, open, readlink, realpath } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import type { RepositoryRecord } from "../../../src/shared/contracts/git-utility";
import { GitUtilityError } from "./git-error";
import type {
  GitProcessCompleted,
  GitProcessOutcome,
  GitProcessRunnerLike,
} from "./git-process";
import {
  MAX_RECOVERY_SNAPSHOT_BYTES,
  MAX_RECOVERY_SNAPSHOT_FILES,
  MAX_RECOVERY_SNAPSHOT_FILE_BYTES,
  MAX_INDEX_BYTES,
  MAX_PATH_BYTES,
  RepositorySnapshotSchema,
  SNAPSHOT_VERSION,
  assertNotAborted,
  copyRepositorySnapshot,
  createSnapshot,
  decodeCanonicalBase64,
  filesystemFailure,
  invalid,
  isErrno,
  outputLimit,
  sha256,
  sortedUnique,
  validatePath,
  type RepositorySnapshot,
  type SnapshotFile,
  type SnapshotIndex,
  type SnapshotPayload,
} from "./recovery-snapshot-schema";
import { safeErrorMessage } from "./redaction";

export interface PinnedDirectory {
  readonly path: string;
  readonly device: number;
  readonly inode: number;
}

export interface FileIdentity {
  readonly device: number;
  readonly inode: number;
  readonly size: number;
  readonly mode: number;
  readonly modifiedMs: number;
  readonly changedMs: number;
}

export interface ExistingMetadata {
  readonly value: Stats;
}

export interface CapturedPath {
  readonly file: SnapshotFile;
  readonly identity: FileIdentity;
  readonly parents: readonly PinnedDirectory[];
}

export interface CapturedIndex {
  readonly index: SnapshotIndex;
  readonly path: string;
  readonly parent: PinnedDirectory;
  readonly identity: FileIdentity | null;
}

export interface PathLists {
  readonly tracked: readonly string[];
  readonly untracked: readonly string[];
}

export interface IndexLock {
  readonly path: string;
  readonly handle: Awaited<ReturnType<typeof open>>;
  readonly parent: PinnedDirectory;
}

export function sameIdentity(metadata: Stats, identity: FileIdentity): boolean {
  return (
    metadata.dev === identity.device &&
    metadata.ino === identity.inode &&
    metadata.size === identity.size &&
    (metadata.mode & 0o777) === identity.mode &&
    metadata.mtimeMs === identity.modifiedMs &&
    metadata.ctimeMs === identity.changedMs
  );
}

export function identityFrom(metadata: Stats): FileIdentity {
  return {
    device: metadata.dev,
    inode: metadata.ino,
    size: metadata.size,
    mode: metadata.mode & 0o777,
    modifiedMs: metadata.mtimeMs,
    changedMs: metadata.ctimeMs,
  };
}

export async function optionalMetadata(
  path: string,
  label: string,
): Promise<ExistingMetadata | null> {
  try {
    return { value: await lstat(path) };
  } catch (error) {
    if (isErrno(error, "ENOENT")) return null;
    throw filesystemFailure(`${label} is not accessible`);
  }
}

export function sameDirectory(
  metadata: Stats,
  directory: PinnedDirectory,
): boolean {
  return metadata.dev === directory.device && metadata.ino === directory.inode;
}

export async function pinDirectory(
  path: string,
  label: string,
): Promise<PinnedDirectory> {
  const metadata = await lstat(path).catch(() => {
    throw filesystemFailure(`${label} is not accessible`);
  });
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    throw invalid(`${label} must be a real directory`);
  }
  const canonical = await realpath(path).catch(() => {
    throw filesystemFailure(`${label} is not accessible`);
  });
  const canonicalMetadata = await lstat(canonical).catch(() => {
    throw filesystemFailure(`${label} is not accessible`);
  });
  if (canonicalMetadata.isSymbolicLink() || !canonicalMetadata.isDirectory()) {
    throw invalid(`${label} must remain a real directory`);
  }
  return {
    path: canonical,
    device: canonicalMetadata.dev,
    inode: canonicalMetadata.ino,
  };
}

export async function assertPinnedDirectory(
  directory: PinnedDirectory,
  label: string,
): Promise<void> {
  const metadata = await lstat(directory.path).catch(() => {
    throw filesystemFailure(`${label} changed during recovery`);
  });
  if (
    metadata.isSymbolicLink() ||
    !metadata.isDirectory() ||
    !sameDirectory(metadata, directory)
  ) {
    throw invalid(`${label} changed during recovery`);
  }
}

export async function syncDirectory(directory: PinnedDirectory): Promise<void> {
  await assertPinnedDirectory(directory, "Repository directory");
  const handle = await open(directory.path, constants.O_RDONLY).catch(() => {
    throw filesystemFailure("Repository directory could not be synchronized");
  });
  try {
    await handle.sync().catch(() => {
      throw filesystemFailure("Repository directory could not be synchronized");
    });
  } finally {
    await handle.close().catch(() => undefined);
  }
}

export function containedPath(root: string, candidate: string): boolean {
  const result = relative(root, candidate);
  return (
    result === "" ||
    (!result.startsWith(`..${sep}`) && result !== ".." && !isAbsolute(result))
  );
}

export async function repositoryDirectories(
  repository: RepositoryRecord,
): Promise<{
  readonly root: PinnedDirectory;
  readonly git: PinnedDirectory;
}> {
  const [root, git] = await Promise.all([
    pinDirectory(repository.path, "Repository root"),
    pinDirectory(repository.gitDirectory, "Repository Git directory"),
  ]);
  if (root.path !== repository.path || git.path !== repository.gitDirectory) {
    throw invalid("Canonical repository directories changed");
  }
  return { root, git };
}

export function outcomeText(
  outcome: GitProcessOutcome,
  stream: "stdout" | "stderr",
): string {
  return outcome.output
    .filter((entry) => entry.stream === stream)
    .map((entry) => entry.data)
    .join("");
}

export function processFailure(
  outcome: Exclude<GitProcessOutcome, GitProcessCompleted>,
): GitUtilityError {
  if (outcome.kind === "cancelled") {
    const suffix =
      outcome.reason === "timeout" ? " timed out" : " was cancelled";
    return new GitUtilityError(
      "commandFailed",
      `Recovery snapshot Git command${suffix}`,
    );
  }
  return new GitUtilityError(
    outcome.code,
    safeErrorMessage(outcomeText(outcome, "stderr") || outcome.message),
    outcome.exitCode,
  );
}

export async function captureGitText(
  runner: GitProcessRunnerLike,
  repository: string,
  args: readonly string[],
  signal: AbortSignal | undefined,
  missingExitCodes: readonly number[] = [],
): Promise<string | null> {
  assertNotAborted(signal);
  const outcome = await runner.run(
    {
      cwd: repository,
      args,
      redactStdout: false,
      outputLimitBytes: MAX_PATH_BYTES,
    },
    signal,
  );
  if (outcome.kind === "completed") return outcomeText(outcome, "stdout");
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

export function parseNulPaths(value: string | null): readonly string[] {
  if (value === null || value.length === 0) return [];
  if (value.includes("\ufffd") || !value.endsWith("\0")) {
    throw invalid("Git returned an invalid path list");
  }
  const paths = value.slice(0, -1).split("\0").map(validatePath);
  if (paths.length > MAX_RECOVERY_SNAPSHOT_FILES) {
    throw outputLimit(
      `Recovery snapshot exceeds ${MAX_RECOVERY_SNAPSHOT_FILES} files`,
    );
  }
  return sortedUnique(paths);
}

export async function capturePathLists(
  runner: GitProcessRunnerLike,
  repository: string,
  signal: AbortSignal | undefined,
): Promise<PathLists> {
  const [indexPaths, headPaths, untrackedPaths] = await Promise.all([
    captureGitText(
      runner,
      repository,
      ["ls-files", "--cached", "-z", "--"],
      signal,
    ),
    captureGitText(
      runner,
      repository,
      ["ls-tree", "-r", "-z", "--name-only", "HEAD", "--"],
      signal,
      [128],
    ),
    captureGitText(
      runner,
      repository,
      ["ls-files", "--others", "--exclude-standard", "-z", "--"],
      signal,
    ),
  ]);
  const tracked = sortedUnique([
    ...parseNulPaths(indexPaths),
    ...parseNulPaths(headPaths),
  ]);
  const untracked = parseNulPaths(untrackedPaths);
  if (tracked.length + untracked.length > MAX_RECOVERY_SNAPSHOT_FILES) {
    throw outputLimit(
      `Recovery snapshot exceeds ${MAX_RECOVERY_SNAPSHOT_FILES} files`,
    );
  }
  const trackedSet = new Set(tracked);
  if (untracked.some((path) => trackedSet.has(path))) {
    throw invalid("Git returned overlapping tracked and untracked paths");
  }
  return { tracked, untracked };
}

export async function pathParents(
  root: PinnedDirectory,
  path: string,
): Promise<readonly PinnedDirectory[] | null> {
  const parts = path.split("/");
  const parents: PinnedDirectory[] = [root];
  let current = root.path;
  for (const part of parts.slice(0, -1)) {
    current = join(current, part);
    if (!containedPath(root.path, current))
      throw invalid("Repository path escaped its root");
    let metadata: Stats;
    try {
      metadata = await lstat(current);
    } catch (error) {
      if (isErrno(error, "ENOENT")) return null;
      throw filesystemFailure("Repository path is not accessible");
    }
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw invalid("Repository path has an unsafe parent");
    }
    parents.push({
      path: current,
      device: metadata.dev,
      inode: metadata.ino,
    });
  }
  return parents;
}

export async function assertParents(
  parents: readonly PinnedDirectory[],
): Promise<void> {
  for (const parent of parents)
    await assertPinnedDirectory(parent, "Repository path parent");
}

export async function readRegularFile(
  path: string,
  metadata: Stats,
  maximumBytes: number,
): Promise<{ readonly bytes: Buffer; readonly identity: FileIdentity }> {
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1) {
    throw invalid(
      "Recovery snapshot supports only regular non-hard-linked files and symlinks",
    );
  }
  if (metadata.size > maximumBytes)
    throw outputLimit("Recovery snapshot file exceeds its byte limit");
  const before = identityFrom(metadata);
  const handle = await open(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW,
  ).catch(() => {
    throw invalid("Recovery snapshot file could not be opened safely");
  });
  try {
    const opened = await handle.stat();
    if (
      !opened.isFile() ||
      opened.nlink !== 1 ||
      !sameIdentity(opened, before)
    ) {
      throw invalid("Recovery snapshot file changed before it could be read");
    }
    const bytes = await handle.readFile();
    if (bytes.byteLength > maximumBytes) {
      throw outputLimit("Recovery snapshot file exceeds its byte limit");
    }
    const after = await handle.stat();
    if (!sameIdentity(after, before)) {
      throw invalid("Recovery snapshot file changed while it was being read");
    }
    return { bytes, identity: before };
  } finally {
    await handle.close().catch(() => undefined);
  }
}

export async function capturePath(
  root: PinnedDirectory,
  path: string,
): Promise<CapturedPath | null> {
  const parents = await pathParents(root, path);
  if (parents === null) return null;
  await assertParents(parents);
  const absolute = join(root.path, ...path.split("/"));
  if (!containedPath(root.path, absolute))
    throw invalid("Repository path escaped its root");
  let metadata: Stats;
  try {
    metadata = await lstat(absolute);
  } catch (error) {
    if (isErrno(error, "ENOENT")) return null;
    throw filesystemFailure("Repository file is not accessible");
  }
  if (metadata.isDirectory()) {
    throw invalid(
      "Recovery snapshot cannot safely capture a tracked directory or submodule",
    );
  }
  if (metadata.isSymbolicLink()) {
    const identity = identityFrom(metadata);
    const target = await readlink(absolute, { encoding: "buffer" }).catch(
      () => {
        throw filesystemFailure("Repository symlink could not be read");
      },
    );
    const after = await lstat(absolute).catch(() => {
      throw invalid("Repository symlink changed while it was being read");
    });
    if (!after.isSymbolicLink() || !sameIdentity(after, identity)) {
      throw invalid("Repository symlink changed while it was being read");
    }
    await assertParents(parents);
    const bytes = Buffer.from(target);
    if (bytes.byteLength > MAX_RECOVERY_SNAPSHOT_FILE_BYTES) {
      throw outputLimit("Recovery snapshot symlink exceeds its byte limit");
    }
    return {
      file: {
        path,
        kind: "symlink",
        mode: 0,
        bytesBase64: bytes.toString("base64"),
        sha256: sha256(bytes),
      },
      identity,
      parents,
    };
  }
  const captured = await readRegularFile(
    absolute,
    metadata,
    MAX_RECOVERY_SNAPSHOT_FILE_BYTES,
  );
  await assertParents(parents);
  return {
    file: {
      path,
      kind: "file",
      mode: captured.identity.mode,
      bytesBase64: captured.bytes.toString("base64"),
      sha256: sha256(captured.bytes),
    },
    identity: captured.identity,
    parents,
  };
}

export async function assertCapturedPath(
  root: PinnedDirectory,
  captured: CapturedPath,
): Promise<void> {
  await assertParents(captured.parents);
  const absolute = join(root.path, ...captured.file.path.split("/"));
  const metadata = await lstat(absolute).catch(() => {
    throw invalid(
      "Repository file changed while the snapshot was being captured",
    );
  });
  if (!sameIdentity(metadata, captured.identity)) {
    throw invalid(
      "Repository file changed while the snapshot was being captured",
    );
  }
}

export async function captureIndex(
  git: PinnedDirectory,
): Promise<CapturedIndex> {
  await assertPinnedDirectory(git, "Repository Git directory");
  const path = join(git.path, "index");
  const lockPath = join(git.path, "index.lock");
  try {
    await lstat(lockPath);
    throw invalid("Repository index is busy");
  } catch (error) {
    if (!isErrno(error, "ENOENT")) throw error;
  }
  let metadata: Stats;
  try {
    metadata = await lstat(path);
  } catch (error) {
    if (isErrno(error, "ENOENT")) {
      return {
        index: { kind: "missing" },
        path,
        parent: git,
        identity: null,
      };
    }
    throw filesystemFailure("Repository index is not accessible");
  }
  const captured = await readRegularFile(path, metadata, MAX_INDEX_BYTES);
  await assertPinnedDirectory(git, "Repository Git directory");
  return {
    index: {
      kind: "file",
      mode: captured.identity.mode,
      bytesBase64: captured.bytes.toString("base64"),
      sha256: sha256(captured.bytes),
    },
    path,
    parent: git,
    identity: captured.identity,
  };
}

export async function assertCapturedIndex(index: CapturedIndex): Promise<void> {
  await assertPinnedDirectory(index.parent, "Repository Git directory");
  const existing = await optionalMetadata(index.path, "Repository index");
  if (
    (index.identity === null && existing !== null) ||
    (index.identity !== null &&
      (existing === null || !sameIdentity(existing.value, index.identity)))
  ) {
    throw invalid(
      "Repository index changed while the snapshot was being captured",
    );
  }
  try {
    await lstat(join(index.parent.path, "index.lock"));
    throw invalid(
      "Repository index became busy while the snapshot was being captured",
    );
  } catch (error) {
    if (!isErrno(error, "ENOENT")) throw error;
  }
}

export function samePathLists(left: PathLists, right: PathLists): boolean {
  return (
    left.tracked.length === right.tracked.length &&
    left.untracked.length === right.untracked.length &&
    left.tracked.every((path, index) => path === right.tracked[index]) &&
    left.untracked.every((path, index) => path === right.untracked[index])
  );
}

export async function captureRepositorySnapshot(
  runner: GitProcessRunnerLike,
  repository: RepositoryRecord,
  signal?: AbortSignal,
): Promise<RepositorySnapshot> {
  assertNotAborted(signal);
  const directories = await repositoryDirectories(repository);
  const initialPaths = await capturePathLists(runner, repository.path, signal);
  const managedPaths = sortedUnique([
    ...initialPaths.tracked,
    ...initialPaths.untracked,
  ]);
  const capturedFiles: CapturedPath[] = [];
  let totalBytes = 0;
  for (const path of managedPaths) {
    assertNotAborted(signal);
    const captured = await capturePath(directories.root, path);
    if (captured === null) {
      if (initialPaths.untracked.includes(path)) {
        throw invalid(
          "An untracked file disappeared while its snapshot was being captured",
        );
      }
      continue;
    }
    const bytes = decodeCanonicalBase64(captured.file.bytesBase64);
    if (bytes === null) throw invalid("Captured snapshot bytes are invalid");
    totalBytes += bytes.value.byteLength;
    if (totalBytes > MAX_RECOVERY_SNAPSHOT_BYTES) {
      throw outputLimit(
        `Recovery snapshot exceeds ${MAX_RECOVERY_SNAPSHOT_BYTES} bytes`,
      );
    }
    capturedFiles.push(captured);
  }
  const capturedIndex = await captureIndex(directories.git);
  if (capturedIndex.index.kind === "file") {
    const indexBytes = decodeCanonicalBase64(capturedIndex.index.bytesBase64);
    if (indexBytes === null) throw invalid("Captured index bytes are invalid");
    totalBytes += indexBytes.value.byteLength;
    if (totalBytes > MAX_RECOVERY_SNAPSHOT_BYTES) {
      throw outputLimit(
        `Recovery snapshot exceeds ${MAX_RECOVERY_SNAPSHOT_BYTES} bytes`,
      );
    }
  }
  const finalPaths = await capturePathLists(runner, repository.path, signal);
  if (!samePathLists(initialPaths, finalPaths)) {
    throw invalid(
      "Repository paths changed while the snapshot was being captured",
    );
  }
  for (const captured of capturedFiles) {
    assertNotAborted(signal);
    await assertCapturedPath(directories.root, captured);
  }
  await assertCapturedIndex(capturedIndex);
  await Promise.all([
    assertPinnedDirectory(directories.root, "Repository root"),
    assertPinnedDirectory(directories.git, "Repository Git directory"),
  ]);
  const payload: SnapshotPayload = {
    version: SNAPSHOT_VERSION,
    trackedPaths: [...initialPaths.tracked],
    untrackedPaths: [...initialPaths.untracked],
    files: capturedFiles.map(({ file }) => ({ ...file })),
    index: { ...capturedIndex.index },
    totalBytes,
  };
  const snapshot = createSnapshot(payload);
  const validated = RepositorySnapshotSchema.safeParse(snapshot);
  if (!validated.success)
    throw invalid("Captured repository snapshot is invalid");
  return copyRepositorySnapshot(validated.data);
}
