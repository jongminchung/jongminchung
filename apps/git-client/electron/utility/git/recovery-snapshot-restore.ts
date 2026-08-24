import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import type { Stats } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readdir,
  rename,
  rmdir,
  symlink,
  unlink,
} from "node:fs/promises";
import { join } from "node:path";
import type { RepositoryRecord } from "../../../src/shared/contracts/git-utility";
import type { GitProcessRunnerLike } from "./git-process";
import {
  assertPinnedDirectory,
  assertParents,
  capturePath,
  captureRepositorySnapshot,
  containedPath,
  optionalMetadata,
  pathParents,
  pinDirectory,
  readRegularFile,
  repositoryDirectories,
  syncDirectory,
  type IndexLock,
  type PinnedDirectory,
} from "./recovery-snapshot-capture";
import {
  MAX_RECOVERY_SNAPSHOT_FILES,
  MAX_INDEX_BYTES,
  RepositorySnapshotSchema,
  assertNotAborted,
  decodeCanonicalBase64,
  filesystemFailure,
  invalid,
  isErrno,
  outputLimit,
  pathDepth,
  sameSnapshot,
  sha256,
  validatePath,
  type RepositorySnapshot,
  type SnapshotFile,
  type SnapshotIndex,
} from "./recovery-snapshot-schema";

export function sameSnapshotFile(
  left: SnapshotFile,
  right: SnapshotFile,
): boolean {
  return (
    left.path === right.path &&
    left.kind === right.kind &&
    left.mode === right.mode &&
    left.sha256 === right.sha256 &&
    left.bytesBase64 === right.bytesBase64
  );
}

export async function assertStoredFile(
  root: PinnedDirectory,
  expected: SnapshotFile,
): Promise<void> {
  const captured = await capturePath(root, expected.path);
  if (captured === null || !sameSnapshotFile(captured.file, expected)) {
    throw invalid("Repository file changed during recovery");
  }
}

export async function inspectConflictDirectory(
  root: PinnedDirectory,
  relativePath: string,
  currentFiles: ReadonlyMap<string, SnapshotFile>,
  directories: Set<string>,
  visited: { count: number },
): Promise<void> {
  if (visited.count > MAX_RECOVERY_SNAPSHOT_FILES) {
    throw outputLimit("Recovery directory preflight exceeds its file limit");
  }
  const absolute = join(root.path, ...relativePath.split("/"));
  const pinned = await pinDirectory(absolute, "Recovery conflict directory");
  if (!containedPath(root.path, pinned.path))
    throw invalid("Recovery directory escaped its root");
  directories.add(relativePath);
  const entries = await readdir(pinned.path, {
    withFileTypes: true,
    encoding: "utf8",
  });
  for (const entry of entries) {
    visited.count += 1;
    if (entry.name.includes("/") || entry.name === "." || entry.name === "..") {
      throw invalid("Recovery directory contains an unsafe entry");
    }
    const childPath = `${relativePath}/${entry.name}`;
    validatePath(childPath);
    if (entry.isDirectory()) {
      await inspectConflictDirectory(
        root,
        childPath,
        currentFiles,
        directories,
        visited,
      );
      continue;
    }
    if (!entry.isFile() && !entry.isSymbolicLink()) {
      throw invalid("Recovery directory contains an unsupported file type");
    }
    if (!currentFiles.has(childPath)) {
      throw invalid("Recovery would overwrite an unmanaged file");
    }
  }
  await assertPinnedDirectory(pinned, "Recovery conflict directory");
}

export async function preflightTopology(
  root: PinnedDirectory,
  target: RepositorySnapshot,
  current: RepositorySnapshot,
): Promise<readonly string[]> {
  const targetFiles = new Map(target.files.map((file) => [file.path, file]));
  const currentFiles = new Map(current.files.map((file) => [file.path, file]));
  const conflictDirectories = new Set<string>();
  for (const targetFile of target.files) {
    let prefix = "";
    const parts = targetFile.path.split("/");
    for (const part of parts.slice(0, -1)) {
      prefix = prefix.length === 0 ? part : `${prefix}/${part}`;
      const absolute = join(root.path, ...prefix.split("/"));
      let metadata: Stats;
      try {
        metadata = await lstat(absolute);
      } catch (error) {
        if (isErrno(error, "ENOENT")) break;
        throw filesystemFailure("Recovery path is not accessible");
      }
      if (metadata.isDirectory() && !metadata.isSymbolicLink()) continue;
      if (!currentFiles.has(prefix) || targetFiles.has(prefix)) {
        throw invalid("Recovery path has an unmanaged or unsafe parent");
      }
      break;
    }
    const absolute = join(root.path, ...targetFile.path.split("/"));
    let metadata: Stats;
    try {
      metadata = await lstat(absolute);
    } catch (error) {
      if (isErrno(error, "ENOENT")) continue;
      throw filesystemFailure("Recovery destination is not accessible");
    }
    if (metadata.isDirectory() && !metadata.isSymbolicLink()) {
      await inspectConflictDirectory(
        root,
        targetFile.path,
        currentFiles,
        conflictDirectories,
        {
          count: 0,
        },
      );
    } else if (!currentFiles.has(targetFile.path)) {
      throw invalid("Recovery would overwrite an unmanaged file");
    }
  }
  return [...conflictDirectories].sort(
    (left, right) => pathDepth(right) - pathDepth(left),
  );
}

export async function safeUnlink(
  root: PinnedDirectory,
  expected: SnapshotFile,
): Promise<void> {
  await assertStoredFile(root, expected);
  const parents = await pathParents(root, expected.path);
  if (parents === null)
    throw invalid("Repository path changed during recovery");
  await assertParents(parents);
  const absolute = join(root.path, ...expected.path.split("/"));
  await unlink(absolute).catch(() => {
    throw filesystemFailure(
      "Repository file could not be removed during recovery",
    );
  });
  await syncDirectory(parents[parents.length - 1] ?? root);
}

export async function ensureParentDirectories(
  root: PinnedDirectory,
  path: string,
): Promise<PinnedDirectory> {
  const parts = path.split("/").slice(0, -1);
  let current = root;
  for (const part of parts) {
    await assertPinnedDirectory(current, "Repository path parent");
    const childPath = join(current.path, part);
    let metadata: Stats;
    try {
      metadata = await lstat(childPath);
    } catch (error) {
      if (!isErrno(error, "ENOENT"))
        throw filesystemFailure("Repository path is not accessible");
      await mkdir(childPath, { mode: 0o755 }).catch(() => {
        throw filesystemFailure("Repository directory could not be created");
      });
      await syncDirectory(current);
      metadata = await lstat(childPath).catch(() => {
        throw filesystemFailure("Repository directory is not accessible");
      });
    }
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
      throw invalid("Repository path parent changed during recovery");
    }
    current = {
      path: childPath,
      device: metadata.dev,
      inode: metadata.ino,
    };
  }
  return current;
}

export async function writeSnapshotFile(
  root: PinnedDirectory,
  target: SnapshotFile,
  current: SnapshotFile | null,
): Promise<void> {
  if (current !== null && sameSnapshotFile(target, current)) return;
  if (current !== null) await assertStoredFile(root, current);
  const parent = await ensureParentDirectories(root, target.path);
  const destination = join(root.path, ...target.path.split("/"));
  if (current === null) {
    try {
      await lstat(destination);
      throw invalid("Recovery destination appeared during recovery");
    } catch (error) {
      if (!isErrno(error, "ENOENT")) throw error;
    }
  }
  const temporary = join(
    parent.path,
    `.git-client-recovery-${randomUUID()}.tmp`,
  );
  const bytes = decodeCanonicalBase64(target.bytesBase64);
  if (bytes === null || sha256(bytes.value) !== target.sha256) {
    throw invalid("Recovery snapshot content is invalid");
  }
  let created = false;
  try {
    if (target.kind === "file") {
      const handle = await open(
        temporary,
        constants.O_WRONLY |
          constants.O_CREAT |
          constants.O_EXCL |
          constants.O_NOFOLLOW,
        target.mode,
      ).catch(() => {
        throw filesystemFailure("Recovery temporary file could not be created");
      });
      created = true;
      try {
        await handle.writeFile(bytes.value);
        await handle.sync();
      } finally {
        await handle.close().catch(() => undefined);
      }
      await chmod(temporary, target.mode).catch(() => {
        throw filesystemFailure(
          "Recovery temporary file mode could not be set",
        );
      });
    } else {
      await symlink(bytes.value, temporary);
      created = true;
    }
    await assertPinnedDirectory(parent, "Repository path parent");
    if (current !== null) await assertStoredFile(root, current);
    await rename(temporary, destination).catch(() => {
      throw filesystemFailure("Recovery file could not be replaced");
    });
    created = false;
    await syncDirectory(parent);
  } finally {
    if (created) await unlink(temporary).catch(() => undefined);
  }
}

export async function acquireIndexLock(
  git: PinnedDirectory,
  current: SnapshotIndex,
): Promise<IndexLock> {
  await assertPinnedDirectory(git, "Repository Git directory");
  const path = join(git.path, "index.lock");
  const handle = await open(
    path,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o600,
  ).catch((error: unknown) => {
    if (isErrno(error, "EEXIST")) throw invalid("Repository index is busy");
    throw filesystemFailure("Repository index lock could not be created");
  });
  const lock = { path, handle, parent: git };
  try {
    const captured = await captureIndexWithExistingLock(git);
    if (!sameSnapshotIndex(captured, current)) {
      throw invalid("Repository index changed before recovery");
    }
    return lock;
  } catch (error) {
    await handle.close().catch(() => undefined);
    await unlink(path).catch(() => undefined);
    throw error;
  }
}

export async function captureIndexWithExistingLock(
  git: PinnedDirectory,
): Promise<SnapshotIndex> {
  const path = join(git.path, "index");
  let metadata: Stats;
  try {
    metadata = await lstat(path);
  } catch (error) {
    if (isErrno(error, "ENOENT")) return { kind: "missing" };
    throw filesystemFailure("Repository index is not accessible");
  }
  const captured = await readRegularFile(path, metadata, MAX_INDEX_BYTES);
  return {
    kind: "file",
    mode: captured.identity.mode,
    bytesBase64: captured.bytes.toString("base64"),
    sha256: sha256(captured.bytes),
  };
}

export function sameSnapshotIndex(
  left: SnapshotIndex,
  right: SnapshotIndex,
): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "missing" || right.kind === "missing") return true;
  return (
    left.mode === right.mode &&
    left.sha256 === right.sha256 &&
    left.bytesBase64 === right.bytesBase64
  );
}

export async function commitIndexLock(
  lock: IndexLock,
  target: SnapshotIndex,
): Promise<void> {
  const indexPath = join(lock.parent.path, "index");
  try {
    if (target.kind === "file") {
      const bytes = decodeCanonicalBase64(target.bytesBase64);
      if (bytes === null || sha256(bytes.value) !== target.sha256) {
        throw invalid("Recovery index snapshot is invalid");
      }
      await lock.handle.writeFile(bytes.value);
      await lock.handle.sync();
      await lock.handle.close();
      await chmod(lock.path, target.mode).catch(() => {
        throw filesystemFailure("Recovery index mode could not be set");
      });
      await assertPinnedDirectory(lock.parent, "Repository Git directory");
      await rename(lock.path, indexPath).catch(() => {
        throw filesystemFailure("Recovery index could not be replaced");
      });
    } else {
      await lock.handle.sync();
      await lock.handle.close();
      const existing = await optionalMetadata(indexPath, "Repository index");
      if (existing !== null) {
        if (
          existing.value.isSymbolicLink() ||
          !existing.value.isFile() ||
          existing.value.nlink !== 1
        ) {
          throw invalid("Repository index became unsafe during recovery");
        }
        await unlink(indexPath);
      }
      await unlink(lock.path);
    }
    await syncDirectory(lock.parent);
  } catch (error) {
    await lock.handle.close().catch(() => undefined);
    await unlink(lock.path).catch(() => undefined);
    throw error;
  }
}

export async function releaseIndexLock(lock: IndexLock): Promise<void> {
  await lock.handle.close().catch(() => undefined);
  await unlink(lock.path).catch(() => undefined);
}

export async function restoreRepositorySnapshot(
  runner: GitProcessRunnerLike,
  repository: RepositoryRecord,
  target: RepositorySnapshot,
  expectedCurrent: RepositorySnapshot,
  signal?: AbortSignal,
  verifyAfter = true,
): Promise<void> {
  assertNotAborted(signal);
  const parsedTarget = RepositorySnapshotSchema.safeParse(target);
  const parsedCurrent = RepositorySnapshotSchema.safeParse(expectedCurrent);
  if (!parsedTarget.success || !parsedCurrent.success) {
    throw invalid("Recovery repository snapshot is invalid");
  }
  const live = await captureRepositorySnapshot(runner, repository, signal);
  if (!sameSnapshot(live, parsedCurrent.data)) {
    throw invalid("Repository changed before recovery could start");
  }
  const directories = await repositoryDirectories(repository);
  const conflictDirectories = await preflightTopology(
    directories.root,
    parsedTarget.data,
    parsedCurrent.data,
  );
  assertNotAborted(signal);
  const indexLock = await acquireIndexLock(
    directories.git,
    parsedCurrent.data.index,
  );
  try {
    assertNotAborted(signal);
    const targetFiles = new Map(
      parsedTarget.data.files.map((file) => [file.path, file]),
    );
    const currentFiles = new Map(
      parsedCurrent.data.files.map((file) => [file.path, file]),
    );
    const removals = parsedCurrent.data.files
      .filter((file) => !targetFiles.has(file.path))
      .sort((left, right) => pathDepth(right.path) - pathDepth(left.path));
    for (const file of removals) await safeUnlink(directories.root, file);
    for (const path of conflictDirectories) {
      const absolute = join(directories.root.path, ...path.split("/"));
      const metadata = await lstat(absolute).catch(() => {
        throw invalid("Recovery conflict directory changed");
      });
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        throw invalid("Recovery conflict directory changed");
      }
      await rmdir(absolute).catch(() => {
        throw invalid("Recovery conflict directory is not empty");
      });
    }
    for (const file of parsedTarget.data.files) {
      await writeSnapshotFile(
        directories.root,
        file,
        currentFiles.get(file.path) ?? null,
      );
    }
    await commitIndexLock(indexLock, parsedTarget.data.index);
  } catch (error) {
    await releaseIndexLock(indexLock);
    throw error;
  }
  if (verifyAfter) {
    const restored = await captureRepositorySnapshot(runner, repository);
    if (!sameSnapshot(restored, parsedTarget.data)) {
      throw invalid("Repository snapshot verification failed after recovery");
    }
  }
}
