import { Buffer, isUtf8 } from "node:buffer";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import type { Stats } from "node:fs";
import { chmod, lstat, open, realpath, rename, unlink } from "node:fs/promises";
import {
    dirname,
    isAbsolute,
    join,
    normalize,
    relative,
    resolve,
    sep,
} from "node:path";
import type {
    RepositoryId,
    RepositoryRecord,
} from "../../../src/shared/contracts/git-utility";
import {
    MAX_CHANGELIST_PATHS,
    MAX_GIT_DIAGNOSTIC_BYTES,
    MAX_GIT_OUTPUT_BYTES,
    MAX_INDEX_BYTES,
    ObjectIdSchema,
    assertNotAborted,
    compareUtf8,
    fileIdentity,
    filesystemError,
    invalid,
    isErrno,
    normalizedPath,
    sameIdentity,
    type FileIdentity,
    type IndexBackup,
    type OptionalBytes,
    type OriginalHead,
    type PinnedDirectory,
} from "./changelist-foundation";
import {
    assertPinnedDirectory,
    pinDirectory,
    syncDirectory,
} from "./changelist-storage";
import { GitUtilityError } from "./git-error";
import {
    PATCH_COMMAND_TIMEOUT_MS,
    type PatchProcessCompleted,
    type PatchProcessOutcome,
    type PatchProcessRunnerLike,
} from "./patch-service";
import { safeErrorMessage } from "./redaction";

export function processFailure(
    outcome: Exclude<PatchProcessOutcome, PatchProcessCompleted>,
): GitUtilityError {
    if (outcome.kind === "cancelled") {
        const suffix =
            outcome.reason === "timeout"
                ? " timed out"
                : outcome.reason === "repositoryClosed"
                  ? " cancelled because the repository closed"
                  : " cancelled";
        return new GitUtilityError(
            "commandFailed",
            `Changelist Git command${suffix}`,
        );
    }
    const detail =
        outcome.stderr.byteLength > 0
            ? outcome.stderr.toString("utf8")
            : outcome.message;
    return new GitUtilityError(
        outcome.code,
        safeErrorMessage(detail),
        outcome.exitCode,
    );
}

export async function gitOutcome(
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

export async function captureGit(
    runner: PatchProcessRunnerLike,
    repository: RepositoryRecord,
    args: readonly string[],
    signal: AbortSignal | undefined,
    stdoutLimitBytes = MAX_GIT_OUTPUT_BYTES,
): Promise<Buffer> {
    const outcome = await gitOutcome(
        runner,
        repository,
        args,
        signal,
        stdoutLimitBytes,
    );
    if (outcome.kind !== "completed") throw processFailure(outcome);
    return outcome.stdout;
}

export async function captureOptionalGit(
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

export function decodedGitText(bytes: Buffer, label: string): string {
    if (!isUtf8(bytes) || bytes.includes(0)) {
        throw invalid(`Git returned invalid text for ${label}`);
    }
    return bytes.toString("utf8").trim();
}

export function isContainedPath(parent: string, child: string): boolean {
    const difference = relative(parent, child);
    return (
        difference === "" ||
        (!difference.startsWith(`..${sep}`) &&
            difference !== ".." &&
            !isAbsolute(difference))
    );
}

export async function pinRepository(
    repository: RepositoryRecord,
): Promise<PinnedDirectory> {
    if (repository.isBare) throw invalid("Changelists require a working tree");
    const root = await pinDirectory(repository.path, "Repository root");
    if (root.path !== repository.path) {
        throw new GitUtilityError(
            "repositoryNotOpen",
            "Canonical repository path changed",
        );
    }
    return root;
}

export async function readRegularFile(
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
    const handle = await open(
        path,
        constants.O_RDONLY | constants.O_NOFOLLOW,
    ).catch((error: unknown) => {
        throw filesystemError(error, "Git index cannot be opened safely");
    });
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
            const { bytesRead } = await handle.read(
                chunk,
                0,
                chunk.byteLength,
                null,
            );
            if (bytesRead === 0) break;
            chunks.push(Buffer.from(chunk.subarray(0, bytesRead)));
            totalBytes += bytesRead;
            if (totalBytes > maximumBytes) {
                throw new GitUtilityError(
                    "outputLimit",
                    "Git index exceeds 256 MiB",
                );
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

export async function backupIndex(
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
    if (displayedPath.length === 0)
        throw invalid("Git returned an empty index path");
    const path = isAbsolute(displayedPath)
        ? normalize(displayedPath)
        : resolve(repository.path, displayedPath);
    const canonicalGitDirectory = await realpath(repository.gitDirectory).catch(
        (error: unknown) => {
            throw filesystemError(error, "Git directory is not accessible");
        },
    );
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

export async function restoreIndex(backup: IndexBackup): Promise<void> {
    await assertPinnedDirectory(backup.parent, "Git index parent");
    if (backup.kind === "missing") {
        const existing = await lstat(backup.path).catch((error: unknown) => {
            if (isErrno(error, "ENOENT")) return null;
            throw filesystemError(
                error,
                "Git index is not accessible during rollback",
            );
        });
        if (existing !== null) {
            if (existing.isSymbolicLink() || !existing.isFile()) {
                throw invalid(
                    "Git index changed to an unsafe file during rollback",
                );
            }
            await unlink(backup.path);
        }
        await syncDirectory(backup.parent);
        return;
    }

    const temporary = join(
        backup.parent.path,
        `.index.${randomUUID()}.changelist-rollback`,
    );
    let handle;
    let identity: FileIdentity | null = null;
    try {
        handle = await open(
            temporary,
            constants.O_WRONLY |
                constants.O_CREAT |
                constants.O_EXCL |
                constants.O_NOFOLLOW,
            backup.mode,
        );
        await handle.writeFile(backup.bytes);
        await handle.sync();
        const metadata = await handle.stat();
        if (!metadata.isFile())
            throw invalid("Rollback index is not a regular file");
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
            throw filesystemError(
                error,
                "Git index is not accessible during rollback",
            );
        });
        if (
            destination !== null &&
            (destination.isSymbolicLink() || !destination.isFile())
        ) {
            throw invalid(
                "Git index changed to an unsafe file during rollback",
            );
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

export function selectedPath(
    path: string,
    selected: ReadonlySet<string>,
): boolean {
    for (const candidate of selected) {
        if (path === candidate || path.startsWith(`${candidate}${sep}`))
            return true;
    }
    return false;
}

export function parseIndexEntries(
    bytes: Buffer,
    paths: readonly string[],
): ReadonlyMap<string, string> {
    if (!isUtf8(bytes)) throw invalid("Git returned non-UTF-8 index paths");
    const selected = new Set(paths);
    const entries = new Map<string, string>();
    for (const record of bytes.toString("utf8").split("\0")) {
        if (record.length === 0) continue;
        const separator = record.indexOf("\t");
        if (separator < 0)
            throw invalid("Git returned an invalid index record");
        const path = record.slice(separator + 1);
        normalizedPath(path);
        if (selectedPath(path, selected)) continue;
        const key = `${path}\0${record.slice(0, separator)}`;
        if (entries.has(key))
            throw invalid("Git returned a duplicate index record");
        entries.set(key, record);
    }
    return entries;
}

export function equalEntries(
    left: ReadonlyMap<string, string>,
    right: ReadonlyMap<string, string>,
): boolean {
    if (left.size !== right.size) return false;
    for (const [path, value] of left) {
        if (right.get(path) !== value) return false;
    }
    return true;
}

export function parseNulPaths(bytes: Buffer): readonly string[] {
    if (!isUtf8(bytes)) throw invalid("Git returned non-UTF-8 untracked paths");
    const paths = bytes
        .toString("utf8")
        .split("\0")
        .filter((path) => path.length > 0)
        .map(normalizedPath);
    if (paths.length > MAX_CHANGELIST_PATHS) {
        throw new GitUtilityError(
            "outputLimit",
            "Too many untracked changelist paths",
        );
    }
    return Object.freeze([...new Set(paths)].sort(compareUtf8));
}

export function parsedObjectId(bytes: Buffer, label: string): string {
    const value = decodedGitText(bytes, label);
    const result = ObjectIdSchema.safeParse(value);
    if (!result.success)
        throw invalid(`Git returned an invalid object id for ${label}`);
    return result.data;
}

export async function captureHead(
    runner: PatchProcessRunnerLike,
    repository: RepositoryRecord,
    signal: AbortSignal | undefined,
): Promise<OriginalHead> {
    const [head, symbolicRef] = await Promise.all([
        captureOptionalGit(
            runner,
            repository,
            ["rev-parse", "--verify", "--quiet", "HEAD"],
            signal,
        ),
        captureOptionalGit(
            runner,
            repository,
            ["symbolic-ref", "--quiet", "HEAD"],
            signal,
        ),
    ]);
    return {
        oid:
            head.kind === "missing" ? null : parsedObjectId(head.bytes, "HEAD"),
        symbolicRef:
            symbolicRef.kind === "missing"
                ? null
                : decodedGitText(symbolicRef.bytes, "the symbolic HEAD"),
    };
}

export async function rollbackHead(
    runner: PatchProcessRunnerLike,
    repository: RepositoryRecord,
    original: OriginalHead,
): Promise<void> {
    const current = await captureHead(runner, repository, undefined);
    if (current.oid === original.oid) return;
    if (current.oid === null) {
        throw new GitUtilityError(
            "commandFailed",
            "Committed changelist disappeared before rollback",
        );
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

export async function rollbackTransaction(
    runner: PatchProcessRunnerLike,
    repository: RepositoryRecord,
    originalHead: OriginalHead,
    indexBackup: IndexBackup,
    originalError: unknown,
): Promise<never> {
    const rollbackErrors: string[] = [];
    await rollbackHead(runner, repository, originalHead).catch(
        (error: unknown) => {
            rollbackErrors.push(
                error instanceof Error
                    ? safeErrorMessage(error.message)
                    : "HEAD rollback failed",
            );
        },
    );
    await restoreIndex(indexBackup).catch((error: unknown) => {
        rollbackErrors.push(
            error instanceof Error
                ? safeErrorMessage(error.message)
                : "index rollback failed",
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

export class RepositoryMutex {
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
            if (this.#tails.get(repositoryId) === tail)
                this.#tails.delete(repositoryId);
        }
    }
}
