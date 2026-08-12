import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import type { Stats } from "node:fs";
import { lstat, mkdir, open, realpath, rename, rm } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { z } from "zod";
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
import { GitProcessRunner, type GitProcessRunnerLike } from "./git-process";
import {
    MAX_RECOVERY_ENTRIES,
    MAX_RECOVERY_MANIFEST_BYTES,
    copyRecoveryEntry as copyEntry,
    copyStoredRecoveryEntry as copyStoredEntry,
    decodeRecoveryManifest,
    encodeRecoveryManifest as encodeManifest,
    type StoredRecoveryEntry,
} from "./recovery-manifest";
import {
    MAX_RECOVERY_DIAGNOSTIC_BYTES,
    RecoveryObjectIdSchema,
    affectedRecoveryRefs,
    assertRecoveryNotAborted,
    captureOptionalRecoveryGit,
    createRecoveryRefTransaction,
    hasSafeRecoveryRefStructure,
    recoveryProcessFailure,
    recoveryRefsEqual,
    runRecoveryGit,
    validateRecoveryOperation,
} from "./recovery-ref-transaction";
import {
    captureRepositorySnapshot,
    repositorySnapshotsEqual,
    restoreRepositorySnapshot,
} from "./recovery-snapshot";
import { safeErrorMessage } from "./redaction";

export {
    MAX_RECOVERY_ENTRIES,
    MAX_RECOVERY_MANIFEST_BYTES,
} from "./recovery-manifest";

const RECOVERY_DIRECTORY = "recovery";

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

export interface RecoveryRepositoryRegistryLike {
    get(repositoryId: RepositoryId): RepositoryRecord;
}

function invalid(message: string): GitUtilityError {
    return new GitUtilityError("invalidInput", message);
}

function isErrno(error: unknown, code: string): boolean {
    return (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === code
    );
}

function filesystemError(error: unknown, fallback: string): GitUtilityError {
    if (error instanceof GitUtilityError) return error;
    const detail = error instanceof Error ? error.message : fallback;
    return new GitUtilityError("commandFailed", safeErrorMessage(detail));
}

function sameDirectory(metadata: Stats, directory: PinnedDirectory): boolean {
    return (
        metadata.dev === directory.device && metadata.ino === directory.inode
    );
}

function sameFile(metadata: Stats, file: FileIdentity): boolean {
    return (
        metadata.dev === file.device &&
        metadata.ino === file.inode &&
        metadata.size === file.size
    );
}

function sameFileIdentity(left: FileIdentity, right: FileIdentity): boolean {
    return (
        left.device === right.device &&
        left.inode === right.inode &&
        left.size === right.size
    );
}

function directoryFrom(path: string, metadata: Stats): PinnedDirectory {
    return { path, device: metadata.dev, inode: metadata.ino };
}

function fileFrom(metadata: Stats): FileIdentity {
    return { device: metadata.dev, inode: metadata.ino, size: metadata.size };
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

async function pinDirectory(
    path: string,
    label: string,
): Promise<PinnedDirectory> {
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
    if (
        canonicalMetadata.isSymbolicLink() ||
        !canonicalMetadata.isDirectory()
    ) {
        throw invalid(`${label} must remain a real directory`);
    }
    return directoryFrom(canonical, canonicalMetadata);
}

async function assertPinnedDirectory(
    directory: PinnedDirectory,
    label: string,
): Promise<void> {
    const metadata = await lstat(directory.path).catch((error: unknown) => {
        throw filesystemError(error, `${label} changed during the operation`);
    });
    if (
        metadata.isSymbolicLink() ||
        !metadata.isDirectory() ||
        !sameDirectory(metadata, directory)
    ) {
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
    if (dirname(child.path) !== parent.path)
        throw invalid(`${label} must stay inside its parent`);
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
        if (!isErrno(error, "EEXIST"))
            throw filesystemError(error, `Unable to create ${label}`);
    }
    const child = await optionalChildDirectory(parent, name, label);
    if (child === null)
        throw invalid(`${label} disappeared while it was being created`);
    await syncDirectory(parent);
    return child;
}

async function syncDirectory(directory: PinnedDirectory): Promise<void> {
    await assertPinnedDirectory(directory, "Recovery storage directory");
    const handle = await open(directory.path, constants.O_RDONLY).catch(
        (error: unknown) => {
            throw filesystemError(
                error,
                "Recovery storage directory could not be synchronized",
            );
        },
    );
    try {
        await handle.sync().catch((error: unknown) => {
            throw filesystemError(
                error,
                "Recovery storage directory could not be synchronized",
            );
        });
    } finally {
        await handle.close().catch(() => undefined);
    }
}

async function optionalFileIdentity(
    path: string,
    label: string,
): Promise<FileIdentity | null> {
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
    const handle = await open(
        path,
        constants.O_RDONLY | constants.O_NOFOLLOW,
    ).catch((error: unknown) => {
        throw invalid(
            `Recovery manifest could not be opened safely (${safeErrorMessage(error instanceof Error ? error.message : "open failed")})`,
        );
    });
    let bytes: Buffer;
    try {
        const opened = await handle.stat();
        if (
            !opened.isFile() ||
            opened.nlink !== 1 ||
            !sameFile(opened, before)
        ) {
            throw invalid("Recovery manifest changed before it could be read");
        }
        const chunks: Buffer[] = [];
        let total = 0;
        while (true) {
            const chunk = Buffer.allocUnsafe(
                Math.min(64 * 1024, MAX_RECOVERY_MANIFEST_BYTES - total + 1),
            );
            const { bytesRead } = await handle.read(
                chunk,
                0,
                chunk.byteLength,
                null,
            );
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
    return decodeRecoveryManifest(bytes, repositoryId);
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
    const temporaryPath = join(
        directory.path,
        `.${repositoryId}.${randomUUID()}.tmp`,
    );
    let handle;
    let writeFailure: unknown = null;
    let temporaryIdentity: FileIdentity | null = null;
    try {
        handle = await open(
            temporaryPath,
            constants.O_WRONLY |
                constants.O_CREAT |
                constants.O_EXCL |
                constants.O_NOFOLLOW,
            0o600,
        );
        await handle.writeFile(bytes);
        await handle.sync();
        const temporary = await handle.stat();
        if (
            !temporary.isFile() ||
            temporary.nlink !== 1 ||
            temporary.size !== bytes.byteLength
        ) {
            throw invalid("Recovery manifest temporary file is unsafe");
        }
        temporaryIdentity = fileFrom(temporary);
    } catch (error) {
        writeFailure = filesystemError(
            error,
            "Recovery manifest could not be written",
        );
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
            (previous !== null &&
                (current === null || !sameFileIdentity(current, previous)))
        ) {
            throw invalid(
                "Recovery manifest changed while it was being replaced",
            );
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

class RepositoryMutex {
    readonly #tails = new Map<RepositoryId, Promise<void>>();

    async run<T>(
        repositoryId: RepositoryId,
        operation: () => Promise<T>,
    ): Promise<T> {
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
            if (this.#tails.get(repositoryId) === tail)
                this.#tails.delete(repositoryId);
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
        const operation = validateRecoveryOperation(untrustedOperation);
        return this.#mutex.run(validatedRepositoryId, async () => {
            assertRecoveryNotAborted(signal);
            const repository = await this.#repository(validatedRepositoryId);
            const branch = await this.#currentBranch(repository.path, signal);
            const affected = affectedRecoveryRefs(operation, branch);
            if (affected === null) return null;
            const refs = await this.#captureRefs(
                repository.path,
                affected.names,
                signal,
            );
            const headOid = await this.#head(repository.path, signal);
            const snapshot = await captureRepositorySnapshot(
                this.#runner,
                repository,
                signal,
            );
            const [finalBranch, finalHeadOid, finalRefs] = await Promise.all([
                this.#currentBranch(repository.path, signal),
                this.#head(repository.path, signal),
                this.#captureRefs(repository.path, affected.names, signal),
            ]);
            if (
                branch !== finalBranch ||
                headOid !== finalHeadOid ||
                !recoveryRefsEqual(refs, finalRefs)
            ) {
                throw invalid(
                    "Repository refs changed while the recovery snapshot was being captured",
                );
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

    async list(
        repositoryId: RepositoryId,
        signal?: AbortSignal,
    ): Promise<readonly RecoveryEntry[]> {
        const validatedRepositoryId = validateRepositoryId(repositoryId);
        return this.#mutex.run(validatedRepositoryId, async () => {
            assertRecoveryNotAborted(signal);
            const repository = await this.#repository(validatedRepositoryId);
            const entries = await this.#read(validatedRepositoryId);
            const resolved: RecoveryEntry[] = [];
            for (const entry of entries) {
                assertRecoveryNotAborted(signal);
                resolved.push({
                    ...copyEntry(entry),
                    recoverable: await this.#refsAreRecoverable(
                        repository.path,
                        entry.refs,
                        signal,
                    ),
                });
            }
            return Object.freeze(
                resolved.sort(
                    (left, right) => right.createdAtMs - left.createdAtMs,
                ),
            );
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
            assertRecoveryNotAborted(signal);
            const repository = await this.#repository(validatedRepositoryId);
            const entries = await this.#read(validatedRepositoryId);
            const entry = entries.find((candidate) => candidate.id === entryId);
            if (entry === undefined)
                throw invalid("Recovery entry does not exist");
            if (
                !(await this.#refsAreRecoverable(
                    repository.path,
                    entry.refs,
                    signal,
                ))
            ) {
                throw invalid(
                    "One or more recorded objects are no longer available",
                );
            }
            const currentRefs = await this.#captureRefs(
                repository.path,
                entry.refs.map((reference) => reference.name),
                signal,
            );
            const currentBranch = await this.#currentBranch(
                repository.path,
                signal,
            );
            const currentHeadOid = await this.#head(repository.path, signal);
            const currentSnapshot = await captureRepositorySnapshot(
                this.#runner,
                repository,
                signal,
            );
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
                !recoveryRefsEqual(currentRefs, finalRefs)
            ) {
                throw invalid(
                    "Repository changed while the inverse recovery snapshot was being captured",
                );
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
            assertRecoveryNotAborted(signal);
            const current = new Map(
                currentRefs.map((reference) => [reference.name, reference.oid]),
            );
            const transaction = createRecoveryRefTransaction(
                entry.refs,
                current,
            );
            if (entry.snapshot === null) {
                if (transaction === null) return { entryId, restoredRefs: [] };
                await runRecoveryGit(
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
                assertRecoveryNotAborted(signal);
                if (transaction !== null) {
                    await runRecoveryGit(
                        this.#runner,
                        repository.path,
                        ["update-ref", "--stdin"],
                        signal,
                        transaction.stdin,
                    );
                    refsApplied = true;
                }
                const restored = await captureRepositorySnapshot(
                    this.#runner,
                    repository,
                    signal,
                );
                if (!repositorySnapshotsEqual(restored, entry.snapshot)) {
                    throw invalid(
                        "Repository snapshot verification failed after recovery",
                    );
                }
                return {
                    entryId,
                    restoredRefs:
                        transaction === null
                            ? []
                            : [...transaction.restoredRefs],
                };
            } catch (error) {
                try {
                    const partial = await captureRepositorySnapshot(
                        this.#runner,
                        repository,
                    );
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
                        if (
                            !recoveryRefsEqual(rollbackCurrentRefs, entry.refs)
                        ) {
                            throw invalid(
                                "Repository refs changed before recovery could be rolled back",
                            );
                        }
                        const rollbackCurrent = new Map(
                            rollbackCurrentRefs.map((reference) => [
                                reference.name,
                                reference.oid,
                            ]),
                        );
                        const rollbackTransaction =
                            createRecoveryRefTransaction(
                                currentRefs,
                                rollbackCurrent,
                            );
                        if (rollbackTransaction !== null) {
                            await runRecoveryGit(
                                this.#runner,
                                repository.path,
                                ["update-ref", "--stdin"],
                                undefined,
                                rollbackTransaction.stdin,
                            );
                        }
                    }
                    const rolledBack = await captureRepositorySnapshot(
                        this.#runner,
                        repository,
                    );
                    if (
                        !repositorySnapshotsEqual(rolledBack, currentSnapshot)
                    ) {
                        throw invalid(
                            "Repository snapshot rollback verification failed",
                        );
                    }
                } catch (rollbackError) {
                    throw new GitUtilityError(
                        "commandFailed",
                        `Recovery failed and rollback could not be completed (${safeErrorMessage(
                            rollbackError instanceof Error
                                ? rollbackError.message
                                : "rollback failed",
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
            throw new GitUtilityError(
                "repositoryNotOpen",
                "Repository registry identity changed",
            );
        }
        const directory = await pinDirectory(
            repository.path,
            "Repository root",
        );
        if (directory.path !== repository.path) {
            throw new GitUtilityError(
                "repositoryNotOpen",
                "Canonical repository path changed",
            );
        }
        return repository;
    }

    async #currentBranch(
        repository: string,
        signal: AbortSignal | undefined,
    ): Promise<string | null> {
        const branch = await captureOptionalRecoveryGit(
            this.#runner,
            repository,
            ["symbolic-ref", "--quiet", "--short", "HEAD"],
            [1],
            signal,
        );
        if (branch !== null && !hasSafeRecoveryRefStructure(branch)) {
            throw invalid("Git returned an invalid current branch name");
        }
        return branch;
    }

    async #head(
        repository: string,
        signal: AbortSignal | undefined,
    ): Promise<string | null> {
        const oid = await captureOptionalRecoveryGit(
            this.#runner,
            repository,
            ["rev-parse", "--verify", "--end-of-options", "HEAD"],
            [128],
            signal,
        );
        if (oid !== null && !RecoveryObjectIdSchema.safeParse(oid).success) {
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
            const oid = await captureOptionalRecoveryGit(
                this.#runner,
                repository,
                ["rev-parse", "--verify", "--end-of-options", name],
                [128],
                signal,
            );
            if (
                oid !== null &&
                !RecoveryObjectIdSchema.safeParse(oid).success
            ) {
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
        if (!hasSafeRecoveryRefStructure(name))
            throw invalid("Recovery ref name is invalid");
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
        throw recoveryProcessFailure(outcome);
    }

    async #refsAreRecoverable(
        repository: string,
        refs: readonly RecoveryRef[],
        signal: AbortSignal | undefined,
    ): Promise<boolean> {
        for (const reference of refs) {
            assertRecoveryNotAborted(signal);
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
            if (outcome.kind === "failed" && outcome.code === "commandFailed")
                return false;
            throw recoveryProcessFailure(outcome);
        }
        return true;
    }

    async #read(
        repositoryId: RepositoryId,
    ): Promise<readonly StoredRecoveryEntry[]> {
        const root = await pinDirectory(
            this.#storageRoot,
            "Recovery storage root",
        );
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
        assertRecoveryNotAborted(signal);
        const root = await pinDirectory(
            this.#storageRoot,
            "Recovery storage root",
        );
        const directory = await ensureChildDirectory(
            root,
            RECOVERY_DIRECTORY,
            "Recovery storage directory",
        );
        const entries = (await readManifestFile(directory, repositoryId)) ?? [];
        const next = [
            copyStoredEntry(entry),
            ...entries.map(copyStoredEntry),
        ].slice(0, MAX_RECOVERY_ENTRIES);
        while (
            next.length > 1 &&
            encodeManifest(next).byteLength > MAX_RECOVERY_MANIFEST_BYTES
        ) {
            next.pop();
        }
        if (encodeManifest(next).byteLength > MAX_RECOVERY_MANIFEST_BYTES) {
            throw new GitUtilityError(
                "outputLimit",
                `Recovery manifest exceeds ${MAX_RECOVERY_MANIFEST_BYTES} bytes`,
            );
        }
        assertRecoveryNotAborted(signal);
        await writeManifestFile(directory, repositoryId, next);
    }
}
