import { Buffer, isUtf8 } from "node:buffer";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, rename, unlink } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import type {
    RepositoryId,
    RepositoryRecord,
} from "../../../src/shared/contracts/git-utility";
import type {
    ShelfEntry,
    ShelfFile,
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
import {
    assertPinnedShelfDirectory as assertPinnedDirectory,
    ensureShelfChildDirectory as ensureChildDirectory,
    optionalShelfChildDirectory as optionalChildDirectory,
    pinShelfDirectory as pinDirectory,
    pinShelfRepository as pinRepository,
    readContainedShelfFile as readContainedFile,
    removePinnedShelfDirectory as removePinnedDirectory,
    sameShelfIdentity as sameIdentity,
    syncShelfDirectory as syncDirectory,
    walkExistingShelfParent as walkExistingParent,
    writeContainedShelfFile as writeContainedFile,
    type ContainedShelfFile as ReadFileResult,
    type PinnedShelfDirectory as PinnedDirectory,
} from "./shelf-contained-storage";
import {
    MAX_SHELF_MANIFEST_BYTES,
    MAX_SHELF_PATHS,
    isShelfId,
    parseShelfUntrackedPaths,
    shelfChecksum,
    shelfPathComponents,
    validateShelfCreateInput,
    validateShelfId,
    validateShelfManifestEntry,
    validateShelfRepositoryId,
} from "./shelf-manifest";

export { MAX_SHELF_PATHS } from "./shelf-manifest";

export const MAX_SHELF_PATCH_BYTES = 20 * 1024 * 1024;
export const MAX_SHELF_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_SHELF_TOTAL_BYTES = 100 * 1024 * 1024;
const MAX_SHELF_PATH_OUTPUT_BYTES = 16 * 1024 * 1024;
const MAX_SHELF_DIAGNOSTIC_BYTES = 1024 * 1024;
const MANIFEST_FILE = "manifest.json";
const INDEX_PATCH_FILE = "index.patch";
const WORKTREE_PATCH_FILE = "worktree.patch";
const UNTRACKED_DIRECTORY = "untracked";

export interface ShelfRepositoryRegistryLike {
    get(repositoryId: RepositoryId): RepositoryRecord;
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

function assertNotAborted(signal: AbortSignal | undefined): void {
    if (signal?.aborted !== true) return;
    const suffix =
        signal.reason === "repositoryClosed"
            ? " because the repository closed"
            : "";
    throw new GitUtilityError(
        "commandFailed",
        `Shelf command cancelled${suffix}`,
    );
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
        throw new GitUtilityError(
            "outputLimit",
            "Shelf Git output exceeded its configured limit",
        );
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

async function verifyShelf(
    parent: PinnedDirectory,
    repositoryId: RepositoryId,
    shelfId: string,
    directoryName = shelfId,
): Promise<VerifiedShelf> {
    const directory = await optionalChildDirectory(
        parent,
        directoryName,
        "Shelf directory",
    );
    if (directory === null) throw invalid("Shelf does not exist");
    const manifestFile = await readContainedFile(
        directory,
        MANIFEST_FILE,
        MAX_SHELF_MANIFEST_BYTES,
        "Shelf manifest",
    );
    if (!isUtf8(manifestFile.bytes))
        throw invalid("Shelf manifest must contain valid UTF-8");
    let decoded: unknown;
    try {
        decoded = JSON.parse(manifestFile.bytes.toString("utf8")) as unknown;
    } catch {
        throw invalid("Shelf manifest is not valid JSON");
    }
    const entry = validateShelfManifestEntry(decoded, repositoryId, shelfId);
    const indexPatch = (
        await readContainedFile(
            directory,
            INDEX_PATCH_FILE,
            MAX_SHELF_PATCH_BYTES,
            "Shelf index patch",
        )
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
        shelfChecksum(indexPatch) !== entry.indexPatchChecksum ||
        shelfChecksum(worktreePatch) !== entry.worktreePatchChecksum
    ) {
        throw invalid("Shelf patch checksum mismatch");
    }
    let totalBytes =
        manifestFile.bytes.byteLength +
        indexPatch.byteLength +
        worktreePatch.byteLength;
    const untracked = new Map<string, Buffer>();
    for (const file of entry.files) {
        if (!file.untracked) continue;
        const stored = await readContainedFile(
            directory,
            join(UNTRACKED_DIRECTORY, file.path),
            MAX_SHELF_FILE_BYTES,
            `Shelved file ${file.path}`,
        );
        if (shelfChecksum(stored.bytes) !== file.checksum) {
            throw invalid(`Shelf checksum mismatch for ${file.path}`);
        }
        totalBytes += stored.bytes.byteLength;
        if (totalBytes > MAX_SHELF_TOTAL_BYTES) {
            throw new GitUtilityError(
                "outputLimit",
                "Shelf exceeds the 100 MiB total limit",
            );
        }
        untracked.set(file.path, stored.bytes);
    }
    await assertPinnedDirectory(directory, "Shelf directory");
    return { directory, entry, indexPatch, worktreePatch, untracked };
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
        const input = validateShelfCreateInput(
            untrustedMessage,
            untrustedPaths,
        );
        const validatedRepositoryId = validateShelfRepositoryId(repositoryId);
        return this.#mutex.run(validatedRepositoryId, async () => {
            assertNotAborted(signal);
            const repository = this.#repository(validatedRepositoryId);
            const repositoryRoot = await pinRepository(repository);
            const shelves = await this.#repositoryShelves(
                validatedRepositoryId,
                true,
            );
            if (shelves === null)
                throw invalid("Unable to create shelf storage");
            const shelfId = randomUUID();
            const temporaryName = `.${shelfId}.tmp`;
            const temporaryPath = join(shelves.path, temporaryName);
            await mkdir(temporaryPath, { mode: 0o700 }).catch(
                (error: unknown) => {
                    throw filesystemError(
                        error,
                        "Unable to create temporary shelf",
                    );
                },
            );
            const temporary = await optionalChildDirectory(
                shelves,
                temporaryName,
                "Temporary shelf",
            );
            if (temporary === null)
                throw invalid("Temporary shelf disappeared");
            let committed = false;
            try {
                const indexPatch = await captureGit(
                    this.#runner,
                    repository.path,
                    [
                        "diff",
                        "--binary",
                        "--full-index",
                        "--no-color",
                        "--cached",
                        "--",
                        ...input.paths,
                    ],
                    MAX_SHELF_PATCH_BYTES,
                    signal,
                );
                const worktreePatch = await captureGit(
                    this.#runner,
                    repository.path,
                    [
                        "diff",
                        "--binary",
                        "--full-index",
                        "--no-color",
                        "--",
                        ...input.paths,
                    ],
                    MAX_SHELF_PATCH_BYTES,
                    signal,
                );
                const untrackedOutput = await captureGit(
                    this.#runner,
                    repository.path,
                    [
                        "ls-files",
                        "--others",
                        "--exclude-standard",
                        "-z",
                        "--",
                        ...input.paths,
                    ],
                    MAX_SHELF_PATH_OUTPUT_BYTES,
                    signal,
                );
                const untrackedPaths =
                    parseShelfUntrackedPaths(untrackedOutput);
                const untrackedSet = new Set(untrackedPaths);
                let totalBytes =
                    indexPatch.byteLength + worktreePatch.byteLength;
                if (totalBytes > MAX_SHELF_TOTAL_BYTES) {
                    throw new GitUtilityError(
                        "outputLimit",
                        "Shelf exceeds the 100 MiB total limit",
                    );
                }
                await writeContainedFile(
                    temporary,
                    INDEX_PATCH_FILE,
                    indexPatch,
                    "Shelf index patch",
                );
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
                        throw new GitUtilityError(
                            "outputLimit",
                            "Shelf exceeds the 100 MiB total limit",
                        );
                    }
                    const digest = shelfChecksum(source.bytes);
                    await writeContainedFile(
                        temporary,
                        join(UNTRACKED_DIRECTORY, path),
                        source.bytes,
                        `Shelved file ${path}`,
                    );
                    captured.set(path, { ...source, path, checksum: digest });
                }
                const allPaths = [
                    ...new Set([...input.paths, ...untrackedPaths]),
                ].sort();
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
                    indexPatchChecksum: shelfChecksum(indexPatch),
                    worktreePatchChecksum: shelfChecksum(worktreePatch),
                };
                const manifest = Buffer.from(
                    JSON.stringify({ entry }, null, 2),
                    "utf8",
                );
                if (manifest.byteLength > MAX_SHELF_MANIFEST_BYTES) {
                    throw new GitUtilityError(
                        "outputLimit",
                        "Shelf manifest exceeds 2 MiB",
                    );
                }
                await writeContainedFile(
                    temporary,
                    MANIFEST_FILE,
                    manifest,
                    "Shelf manifest",
                );
                await syncDirectory(temporary);
                await verifyShelf(
                    shelves,
                    validatedRepositoryId,
                    shelfId,
                    temporaryName,
                );
                const destination = join(shelves.path, shelfId);
                try {
                    await lstat(destination);
                    throw invalid("Shelf destination already exists");
                } catch (error) {
                    if (!isErrno(error, "ENOENT")) throw error;
                }
                await assertPinnedDirectory(
                    shelves,
                    "Shelf repository directory",
                );
                await assertPinnedDirectory(temporary, "Temporary shelf");
                await rename(temporary.path, destination);
                const directory = await optionalChildDirectory(
                    shelves,
                    shelfId,
                    "Shelf directory",
                );
                if (
                    directory === null ||
                    !sameIdentity(await lstat(directory.path), temporary)
                ) {
                    throw invalid(
                        "Shelf directory changed while it was being committed",
                    );
                }
                committed = true;
                await syncDirectory(shelves);
                await verifyShelf(shelves, validatedRepositoryId, shelfId);
                await this.#removeShelvedChanges(
                    repository,
                    repositoryRoot,
                    files,
                    captured,
                    signal,
                );
                return entry;
            } catch (error) {
                if (!committed) {
                    await removePinnedDirectory(shelves, temporary).catch(
                        () => undefined,
                    );
                }
                throw filesystemError(error, "Unable to create shelf");
            }
        });
    }

    async list(repositoryId: RepositoryId): Promise<readonly ShelfEntry[]> {
        const validatedRepositoryId = validateShelfRepositoryId(repositoryId);
        this.#repository(validatedRepositoryId);
        const shelves = await this.#repositoryShelves(
            validatedRepositoryId,
            false,
        );
        if (shelves === null) return Object.freeze([]);
        const entries: ShelfEntry[] = [];
        const children = await readdir(shelves.path, {
            withFileTypes: true,
        }).catch((error: unknown) => {
            throw filesystemError(error, "Unable to list shelves");
        });
        for (const child of children) {
            if (!child.isDirectory() || !isShelfId(child.name)) continue;
            try {
                entries.push(
                    (
                        await verifyShelf(
                            shelves,
                            validatedRepositoryId,
                            child.name,
                        )
                    ).entry,
                );
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
        const validatedRepositoryId = validateShelfRepositoryId(repositoryId);
        if (typeof dropAfterApply !== "boolean")
            throw invalid("dropAfterApply must be a boolean");
        await this.#mutex.run(validatedRepositoryId, async () => {
            assertNotAborted(signal);
            const repository = this.#repository(validatedRepositoryId);
            const repositoryRoot = await pinRepository(repository);
            const shelves = await this.#repositoryShelves(
                validatedRepositoryId,
                false,
            );
            if (shelves === null) throw invalid("Shelf does not exist");
            const shelf = await verifyShelf(
                shelves,
                validatedRepositoryId,
                shelfId,
            );
            for (const file of shelf.entry.files) {
                if (file.untracked)
                    await this.#preflightDestination(repositoryRoot, file.path);
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
            if (dropAfterApply)
                await removePinnedDirectory(shelves, shelf.directory);
        });
    }

    async delete(
        repositoryId: RepositoryId,
        untrustedShelfId: unknown,
    ): Promise<void> {
        const shelfId = validateShelfId(untrustedShelfId);
        const validatedRepositoryId = validateShelfRepositoryId(repositoryId);
        await this.#mutex.run(validatedRepositoryId, async () => {
            this.#repository(validatedRepositoryId);
            const shelves = await this.#repositoryShelves(
                validatedRepositoryId,
                false,
            );
            if (shelves === null) return;
            const existing = await optionalChildDirectory(
                shelves,
                shelfId,
                "Shelf directory",
            );
            if (existing === null) return;
            const shelf = await verifyShelf(
                shelves,
                validatedRepositoryId,
                shelfId,
            );
            await removePinnedDirectory(shelves, shelf.directory);
        });
    }

    async #repositoryShelves(
        repositoryId: RepositoryId,
        create: boolean,
    ): Promise<PinnedDirectory | null> {
        const root = await pinDirectory(
            this.#storageRoot,
            "Shelf storage root",
        );
        const shelves = create
            ? await ensureChildDirectory(
                  root,
                  "shelves",
                  "Shelf storage directory",
              )
            : await optionalChildDirectory(
                  root,
                  "shelves",
                  "Shelf storage directory",
              );
        if (shelves === null) return null;
        return create
            ? ensureChildDirectory(
                  shelves,
                  repositoryId,
                  "Repository shelf directory",
              )
            : optionalChildDirectory(
                  shelves,
                  repositoryId,
                  "Repository shelf directory",
              );
    }

    #repository(repositoryId: RepositoryId): RepositoryRecord {
        const repository = this.#registry.get(repositoryId);
        if (repository.id !== repositoryId) {
            throw new GitUtilityError(
                "repositoryNotOpen",
                "Repository registry identity changed",
            );
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
        const tracked = files
            .filter((file) => !file.untracked)
            .map((file) => file.path);
        if (tracked.length > 0) {
            await runGit(
                this.#runner,
                repository.path,
                [
                    "restore",
                    "--source=HEAD",
                    "--staged",
                    "--worktree",
                    "--",
                    ...tracked,
                ],
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
                shelfChecksum(current.bytes) !== stored.checksum
            ) {
                throw invalid(
                    `Untracked file changed while shelving (${stored.path})`,
                );
            }
            const components = shelfPathComponents(stored.path);
            const parent = await walkExistingParent(
                repositoryRoot,
                components.slice(0, -1),
                `Untracked file ${stored.path}`,
            );
            const path = join(parent.path, components.at(-1) as string);
            const metadata = await lstat(path).catch((error: unknown) => {
                throw filesystemError(
                    error,
                    `Untracked file is not accessible (${stored.path})`,
                );
            });
            if (
                metadata.isSymbolicLink() ||
                !metadata.isFile() ||
                !sameIdentity(metadata, stored.identity)
            ) {
                throw invalid(
                    `Untracked file changed while shelving (${stored.path})`,
                );
            }
            await unlink(path).catch((error: unknown) => {
                throw filesystemError(
                    error,
                    `Untracked file could not be removed (${stored.path})`,
                );
            });
            await assertPinnedDirectory(
                parent,
                `Untracked file parent ${stored.path}`,
            );
        }
    }

    async #preflightDestination(
        repositoryRoot: PinnedDirectory,
        path: string,
    ): Promise<void> {
        const components = shelfPathComponents(path);
        let current = repositoryRoot;
        for (const component of components.slice(0, -1)) {
            const child = await optionalChildDirectory(
                current,
                component,
                `Restore parent for ${path}`,
            );
            if (child === null) return;
            current = child;
        }
        try {
            await lstat(join(current.path, components.at(-1) as string));
            throw invalid(
                `Cannot restore shelf because ${path} already exists`,
            );
        } catch (error) {
            if (!isErrno(error, "ENOENT")) throw error;
        }
    }
}
