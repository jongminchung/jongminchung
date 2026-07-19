import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { z } from "zod";
import {
    GitLocalHistoryEntriesSchema,
    GitLocalHistoryEntrySchema,
    RepositoryIdSchema,
    type GitLocalHistoryEntry,
    type RepositoryId,
} from "../../../src/shared/contracts/git-utility";
import { GitUtilityError } from "./git-error";
import type { GitProcessRunnerLike } from "./git-process";
import {
    captureRepositorySnapshot,
    mergeRepositorySnapshotPaths,
    readRepositorySnapshotFile,
    RepositorySnapshotSchema,
    restoreRepositorySnapshot,
    type RepositorySnapshot,
    type RepositorySnapshotFileContent,
} from "./recovery-snapshot";
import type { RepositoryRegistry } from "./repository-registry";

const LOCAL_HISTORY_DIRECTORY = "local-history";
const MANIFEST_VERSION = 1;
const MAX_ENTRIES = 100;
const MAX_DIFF_CHARACTERS = 16 * 1024 * 1024;

const StoredEntrySchema = GitLocalHistoryEntrySchema.unwrap().extend({
    snapshotFile: z.string().uuid(),
}).strict();
const ManifestSchema = z
    .object({
        version: z.literal(MANIFEST_VERSION),
        entries: z.array(StoredEntrySchema).max(MAX_ENTRIES),
    })
    .strict();
type StoredEntry = Readonly<z.infer<typeof StoredEntrySchema>>;

function publicEntry(entry: StoredEntry): GitLocalHistoryEntry {
    return GitLocalHistoryEntrySchema.parse({
        id: entry.id,
        repositoryId: entry.repositoryId,
        createdAtMs: entry.createdAtMs,
        label: entry.label,
        paths: entry.paths,
        snapshotSha256: entry.snapshotSha256,
    });
}

function isErrno(error: unknown, code: string): boolean {
    return (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === code
    );
}

function assertNotAborted(signal?: AbortSignal): void {
    if (signal?.aborted !== true) return;
    throw new GitUtilityError(
        "commandFailed",
        "Local History operation was cancelled",
    );
}

function sameFile(
    left: RepositorySnapshot["files"][number] | undefined,
    right: RepositorySnapshot["files"][number] | undefined,
): boolean {
    return (
        left?.kind === right?.kind &&
        left?.mode === right?.mode &&
        left?.sha256 === right?.sha256
    );
}

function changedPaths(
    previous: RepositorySnapshot | null,
    current: RepositorySnapshot,
): readonly string[] {
    if (previous === null)
        return [...current.trackedPaths, ...current.untrackedPaths].sort();
    const previousFiles = new Map(
        previous.files.map((file) => [file.path, file]),
    );
    const currentFiles = new Map(current.files.map((file) => [file.path, file]));
    const paths = new Set([...previousFiles.keys(), ...currentFiles.keys()]);
    return [...paths]
        .filter(
            (path) =>
                !sameFile(previousFiles.get(path), currentFiles.get(path)),
        )
        .sort();
}

function contentLines(content: RepositorySnapshotFileContent): readonly string[] {
    if (content.kind === "missing") return [];
    if (content.kind === "binary") return ["Binary content"];
    return content.content.split(/\r?\n/u);
}

function createDiff(
    before: RepositorySnapshotFileContent,
    after: RepositorySnapshotFileContent,
    path: string,
): string {
    if (
        before.kind === "text" &&
        after.kind === "text" &&
        before.content === after.content
    )
        return "";
    if (before.kind === "missing" && after.kind === "missing") return "";
    if (before.kind === "binary" || after.kind === "binary")
        return `Binary files ${path} differ`;
    const beforeLines = contentLines(before);
    const afterLines = contentLines(after);
    const diff = [
        `--- Local History/${path}`,
        `+++ Working Tree/${path}`,
        `@@ -1,${beforeLines.length} +1,${afterLines.length} @@`,
        ...beforeLines.map((line) => `-${line}`),
        ...afterLines.map((line) => `+${line}`),
    ].join("\n");
    return diff.slice(0, MAX_DIFF_CHARACTERS);
}

export class LocalHistoryService {
    readonly #registry: RepositoryRegistry;
    readonly #storageRoot: string;
    readonly #runner: GitProcessRunnerLike;
    readonly #mutations = new Map<RepositoryId, Promise<void>>();

    private constructor(
        registry: RepositoryRegistry,
        storageRoot: string,
        runner: GitProcessRunnerLike,
    ) {
        if (!isAbsolute(storageRoot))
            throw new GitUtilityError(
                "invalidInput",
                "Local History storage root must be absolute",
            );
        this.#registry = registry;
        this.#storageRoot = storageRoot;
        this.#runner = runner;
    }

    static of(
        registry: RepositoryRegistry,
        storageRoot: string,
        runner: GitProcessRunnerLike,
    ): LocalHistoryService {
        return new LocalHistoryService(registry, storageRoot, runner);
    }

    async capture(
        repositoryId: RepositoryId,
        label: string | null,
        signal?: AbortSignal,
    ): Promise<GitLocalHistoryEntry> {
        const id = RepositoryIdSchema.parse(repositoryId);
        return this.#serialize(id, () => this.#capture(id, label, signal));
    }

    async #capture(
        id: RepositoryId,
        label: string | null,
        signal?: AbortSignal,
    ): Promise<GitLocalHistoryEntry> {
        assertNotAborted(signal);
        const repository = this.#registry.get(id);
        const snapshot = await captureRepositorySnapshot(
            this.#runner,
            repository,
            signal,
        );
        const manifest = await this.#readManifest(id);
        const latest = manifest.entries[0];
        if (latest?.snapshotSha256 === snapshot.sha256 && label === null)
            return publicEntry(latest);

        const previous =
            latest === undefined ? null : await this.#readSnapshot(id, latest);
        const entryId = randomUUID();
        const entry = StoredEntrySchema.parse({
            id: entryId,
            repositoryId: id,
            createdAtMs: Date.now(),
            label,
            paths: changedPaths(previous, snapshot),
            snapshotSha256: snapshot.sha256,
            snapshotFile: entryId,
        });
        await this.#writeSnapshot(id, entry, snapshot);
        const retained = [entry, ...manifest.entries].slice(0, MAX_ENTRIES);
        await this.#writeManifest(id, retained);
        for (const expired of manifest.entries.slice(MAX_ENTRIES - 1)) {
            await this.#deleteSnapshot(id, expired);
        }
        return publicEntry(entry);
    }

    async list(
        repositoryId: RepositoryId,
        path: string | null,
    ): Promise<readonly GitLocalHistoryEntry[]> {
        const id = RepositoryIdSchema.parse(repositoryId);
        const entries = (await this.#readManifest(id)).entries.filter(
            (entry) => path === null || entry.paths.includes(path),
        );
        return GitLocalHistoryEntriesSchema.parse(entries.map(publicEntry));
    }

    async label(
        repositoryId: RepositoryId,
        entryId: string,
        label: string,
    ): Promise<GitLocalHistoryEntry> {
        const id = RepositoryIdSchema.parse(repositoryId);
        return this.#serialize(id, () => this.#label(id, entryId, label));
    }

    async #label(
        id: RepositoryId,
        entryId: string,
        label: string,
    ): Promise<GitLocalHistoryEntry> {
        const manifest = await this.#readManifest(id);
        const index = manifest.entries.findIndex((entry) => entry.id === entryId);
        if (index < 0)
            throw new GitUtilityError(
                "invalidInput",
                "Local History entry does not exist",
            );
        const current = manifest.entries[index];
        if (current === undefined)
            throw new GitUtilityError(
                "invalidInput",
                "Local History entry does not exist",
            );
        const updated = StoredEntrySchema.parse({ ...current, label });
        const entries = [...manifest.entries];
        entries[index] = updated;
        await this.#writeManifest(id, entries);
        return publicEntry(updated);
    }

    async #serialize<T>(
        repositoryId: RepositoryId,
        operation: () => Promise<T>,
    ): Promise<T> {
        const previous = this.#mutations.get(repositoryId) ?? Promise.resolve();
        const current = previous.catch(() => undefined).then(operation);
        const settled = current.then(
            () => undefined,
            () => undefined,
        );
        this.#mutations.set(repositoryId, settled);
        try {
            return await current;
        } finally {
            if (this.#mutations.get(repositoryId) === settled)
                this.#mutations.delete(repositoryId);
        }
    }

    async diff(
        repositoryId: RepositoryId,
        entryId: string,
        path: string,
        signal?: AbortSignal,
    ): Promise<string> {
        const id = RepositoryIdSchema.parse(repositoryId);
        const entry = await this.#entry(id, entryId);
        const repository = this.#registry.get(id);
        const [snapshot, current] = await Promise.all([
            this.#readSnapshot(id, entry),
            captureRepositorySnapshot(this.#runner, repository, signal),
        ]);
        return createDiff(
            readRepositorySnapshotFile(snapshot, path),
            readRepositorySnapshotFile(current, path),
            path,
        );
    }

    async restore(
        repositoryId: RepositoryId,
        entryId: string,
        path: string,
        signal?: AbortSignal,
    ): Promise<void> {
        const id = RepositoryIdSchema.parse(repositoryId);
        const entry = await this.#entry(id, entryId);
        const repository = this.#registry.get(id);
        const [snapshot, current] = await Promise.all([
            this.#readSnapshot(id, entry),
            captureRepositorySnapshot(this.#runner, repository, signal),
        ]);
        const target = mergeRepositorySnapshotPaths(snapshot, current, [path]);
        await restoreRepositorySnapshot(
            this.#runner,
            repository,
            target,
            current,
            signal,
        );
    }

    async #entry(repositoryId: RepositoryId, entryId: string): Promise<StoredEntry> {
        const entry = (await this.#readManifest(repositoryId)).entries.find(
            (candidate) => candidate.id === entryId,
        );
        if (entry === undefined)
            throw new GitUtilityError(
                "invalidInput",
                "Local History entry does not exist",
            );
        return entry;
    }

    #directory(repositoryId: RepositoryId): string {
        return join(
            this.#storageRoot,
            LOCAL_HISTORY_DIRECTORY,
            RepositoryIdSchema.parse(repositoryId),
        );
    }

    async #readManifest(
        repositoryId: RepositoryId,
    ): Promise<Readonly<{ entries: readonly StoredEntry[] }>> {
        try {
            const value: unknown = JSON.parse(
                await readFile(
                    join(this.#directory(repositoryId), "manifest.json"),
                    "utf8",
                ),
            );
            return ManifestSchema.parse(value);
        } catch (error) {
            if (isErrno(error, "ENOENT")) return { entries: [] };
            if (error instanceof z.ZodError)
                throw new GitUtilityError(
                    "commandFailed",
                    "Local History manifest is invalid",
                );
            throw error;
        }
    }

    async #writeManifest(
        repositoryId: RepositoryId,
        entries: readonly StoredEntry[],
    ): Promise<void> {
        const directory = this.#directory(repositoryId);
        await mkdir(directory, { recursive: true, mode: 0o700 });
        const target = join(directory, "manifest.json");
        const temporary = join(directory, `manifest-${randomUUID()}.tmp`);
        await writeFile(
            temporary,
            JSON.stringify({ version: MANIFEST_VERSION, entries }),
            { encoding: "utf8", mode: 0o600, flag: "wx" },
        );
        await rename(temporary, target);
    }

    async #readSnapshot(
        repositoryId: RepositoryId,
        entry: StoredEntry,
    ): Promise<RepositorySnapshot> {
        const value: unknown = JSON.parse(
            await readFile(
                join(this.#directory(repositoryId), `${entry.snapshotFile}.json`),
                "utf8",
            ),
        );
        const snapshot = RepositorySnapshotSchema.parse(value);
        if (snapshot.sha256 !== entry.snapshotSha256)
            throw new GitUtilityError(
                "commandFailed",
                "Local History snapshot identity does not match its manifest",
            );
        return snapshot;
    }

    async #writeSnapshot(
        repositoryId: RepositoryId,
        entry: StoredEntry,
        snapshot: RepositorySnapshot,
    ): Promise<void> {
        const directory = this.#directory(repositoryId);
        await mkdir(directory, { recursive: true, mode: 0o700 });
        const target = join(directory, `${entry.snapshotFile}.json`);
        const temporary = join(directory, `${entry.snapshotFile}.tmp`);
        await writeFile(temporary, JSON.stringify(snapshot), {
            encoding: "utf8",
            mode: 0o600,
            flag: "wx",
        });
        await rename(temporary, target);
    }

    async #deleteSnapshot(
        repositoryId: RepositoryId,
        entry: StoredEntry,
    ): Promise<void> {
        await unlink(
            join(this.#directory(repositoryId), `${entry.snapshotFile}.json`),
        ).catch((error: unknown) => {
            if (!isErrno(error, "ENOENT")) throw error;
        });
    }
}
