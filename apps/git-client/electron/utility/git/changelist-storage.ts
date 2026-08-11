import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import type { Stats } from "node:fs";
import { lstat, mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  MAX_CHANGELIST_MANIFEST_BYTES,
  assertNotAborted,
  fileIdentity,
  filesystemError,
  invalid,
  isErrno,
  pinnedDirectory,
  sameIdentity,
  type FileIdentity,
  type OptionalBytes,
  type PinnedDirectory,
} from "./changelist-foundation";
import { GitUtilityError } from "./git-error";
import { safeErrorMessage } from "./redaction";

export async function pinDirectory(path: string, label: string): Promise<PinnedDirectory> {
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

export async function assertPinnedDirectory(
  directory: PinnedDirectory,
  label: string,
): Promise<void> {
  const metadata = await lstat(directory.path).catch((error: unknown) => {
    throw filesystemError(error, `${label} changed during the operation`);
  });
  if (metadata.isSymbolicLink() || !metadata.isDirectory() || !sameIdentity(metadata, directory)) {
    throw invalid(`${label} changed during the operation`);
  }
}

export async function optionalChildDirectory(
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

export async function ensureChildDirectory(
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

export async function ensureStorageRoot(path: string): Promise<PinnedDirectory> {
  await mkdir(path, { recursive: true, mode: 0o700 }).catch((error: unknown) => {
    throw filesystemError(error, "Unable to create changelist storage root");
  });
  return pinDirectory(path, "Changelist storage root");
}

export async function readContainedFile(
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

export async function syncDirectory(directory: PinnedDirectory): Promise<void> {
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

export async function atomicWriteContainedFile(
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
