import { Buffer, isUtf8 } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import type { Stats } from "node:fs";
import {
    chmod,
    lstat,
    mkdir,
    open,
    readlink,
    readdir,
    realpath,
    rename,
    rmdir,
    symlink,
    unlink,
} from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { z } from "zod";
import type { RepositoryRecord } from "../../../src/shared/contracts/git-utility";
import { GitUtilityError } from "./git-error";
import type {
    GitProcessCompleted,
    GitProcessOutcome,
    GitProcessRunnerLike,
} from "./git-process";
import { safeErrorMessage } from "./redaction";

export const MAX_RECOVERY_SNAPSHOT_FILES = 20_000;
export const MAX_RECOVERY_SNAPSHOT_FILE_BYTES = 16 * 1024 * 1024;
export const MAX_RECOVERY_SNAPSHOT_BYTES = 64 * 1024 * 1024;

const MAX_INDEX_BYTES = 64 * 1024 * 1024;
const MAX_PATH_BYTES = 8 * 1024 * 1024;
const MAX_PATH_CHARACTERS = 16_384;
const SNAPSHOT_VERSION = 1;

const ChecksumSchema = z.string().regex(/^[0-9a-f]{64}$/u);
const SafePathSchema = z
    .string()
    .min(1)
    .max(MAX_PATH_CHARACTERS)
    .refine(isSafeRepositoryPath, "Repository snapshot path is unsafe");

const SnapshotFileSchema = z
    .object({
        path: SafePathSchema,
        kind: z.enum(["file", "symlink"]),
        mode: z.number().int().min(0).max(0o777),
        bytesBase64: z
            .string()
            .max(encodedLength(MAX_RECOVERY_SNAPSHOT_FILE_BYTES)),
        sha256: ChecksumSchema,
    })
    .strict()
    .superRefine((file, context) => {
        const bytes = decodeCanonicalBase64(file.bytesBase64);
        if (bytes === null) {
            context.addIssue({
                code: "custom",
                message: "Snapshot bytes are not canonical base64",
            });
            return;
        }
        if (bytes.value.byteLength > MAX_RECOVERY_SNAPSHOT_FILE_BYTES) {
            context.addIssue({
                code: "custom",
                message: "Snapshot file exceeds its byte limit",
            });
        }
        if (sha256(bytes.value) !== file.sha256) {
            context.addIssue({
                code: "custom",
                message: "Snapshot file checksum mismatch",
            });
        }
        if (file.kind === "symlink" && file.mode !== 0) {
            context.addIssue({
                code: "custom",
                message: "Snapshot symlink mode must be zero",
            });
        }
    });

const SnapshotIndexSchema = z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("missing") }).strict(),
    z
        .object({
            kind: z.literal("file"),
            mode: z.number().int().min(0).max(0o777),
            bytesBase64: z.string().max(encodedLength(MAX_INDEX_BYTES)),
            sha256: ChecksumSchema,
        })
        .strict()
        .superRefine((index, context) => {
            const bytes = decodeCanonicalBase64(index.bytesBase64);
            if (bytes === null) {
                context.addIssue({
                    code: "custom",
                    message: "Index bytes are not canonical base64",
                });
                return;
            }
            if (bytes.value.byteLength > MAX_INDEX_BYTES) {
                context.addIssue({
                    code: "custom",
                    message: "Snapshot index exceeds its byte limit",
                });
            }
            if (sha256(bytes.value) !== index.sha256) {
                context.addIssue({
                    code: "custom",
                    message: "Snapshot index checksum mismatch",
                });
            }
        }),
]);

const RepositorySnapshotPayloadSchema = z
    .object({
        version: z.literal(SNAPSHOT_VERSION),
        trackedPaths: z.array(SafePathSchema).max(MAX_RECOVERY_SNAPSHOT_FILES),
        untrackedPaths: z
            .array(SafePathSchema)
            .max(MAX_RECOVERY_SNAPSHOT_FILES),
        files: z.array(SnapshotFileSchema).max(MAX_RECOVERY_SNAPSHOT_FILES),
        index: SnapshotIndexSchema,
        totalBytes: z
            .number()
            .int()
            .nonnegative()
            .max(MAX_RECOVERY_SNAPSHOT_BYTES),
    })
    .strict()
    .superRefine((snapshot, context) => {
        validateSortedUnique(snapshot.trackedPaths, ["trackedPaths"], context);
        validateSortedUnique(
            snapshot.untrackedPaths,
            ["untrackedPaths"],
            context,
        );
        validateSortedUnique(
            snapshot.files.map((file) => file.path),
            ["files"],
            context,
        );
        const tracked = new Set(snapshot.trackedPaths);
        for (const [index, path] of snapshot.untrackedPaths.entries()) {
            if (tracked.has(path)) {
                context.addIssue({
                    code: "custom",
                    message: "A snapshot path cannot be tracked and untracked",
                    path: ["untrackedPaths", index],
                });
            }
        }
        const managed = new Set([
            ...snapshot.trackedPaths,
            ...snapshot.untrackedPaths,
        ]);
        for (const [index, file] of snapshot.files.entries()) {
            if (!managed.has(file.path)) {
                context.addIssue({
                    code: "custom",
                    message: "Snapshot file is not a managed path",
                    path: ["files", index, "path"],
                });
            }
        }
        for (const path of snapshot.untrackedPaths) {
            if (!snapshot.files.some((file) => file.path === path)) {
                context.addIssue({
                    code: "custom",
                    message: "Untracked snapshot path must have content",
                    path: ["untrackedPaths"],
                });
            }
        }
        const paths = snapshot.files.map((file) => file.path);
        if (hasPathPrefixConflict(paths)) {
            context.addIssue({
                code: "custom",
                message: "Snapshot file paths overlap",
            });
        }
        const totalBytes = snapshot.files.reduce(
            (total, file) =>
                total +
                (decodeCanonicalBase64(file.bytesBase64)?.value.byteLength ??
                    0),
            snapshot.index.kind === "file"
                ? (decodeCanonicalBase64(snapshot.index.bytesBase64)?.value
                      .byteLength ?? 0)
                : 0,
        );
        if (totalBytes !== snapshot.totalBytes) {
            context.addIssue({
                code: "custom",
                message: "Snapshot byte total mismatch",
            });
        }
    });

export const RepositorySnapshotSchema = RepositorySnapshotPayloadSchema.extend({
    sha256: ChecksumSchema,
})
    .strict()
    .superRefine((snapshot, context) => {
        const payload = snapshotPayload(snapshot);
        if (
            sha256(Buffer.from(JSON.stringify(payload), "utf8")) !==
            snapshot.sha256
        ) {
            context.addIssue({
                code: "custom",
                message: "Repository snapshot checksum mismatch",
            });
        }
    });

export type RepositorySnapshot = z.infer<typeof RepositorySnapshotSchema>;
type SnapshotFile = z.infer<typeof SnapshotFileSchema>;
type SnapshotIndex = z.infer<typeof SnapshotIndexSchema>;
type SnapshotPayload = z.infer<typeof RepositorySnapshotPayloadSchema>;

interface PinnedDirectory {
    readonly path: string;
    readonly device: number;
    readonly inode: number;
}

interface FileIdentity {
    readonly device: number;
    readonly inode: number;
    readonly size: number;
    readonly mode: number;
    readonly modifiedMs: number;
    readonly changedMs: number;
}

interface ExistingMetadata {
    readonly value: Stats;
}

interface CapturedPath {
    readonly file: SnapshotFile;
    readonly identity: FileIdentity;
    readonly parents: readonly PinnedDirectory[];
}

interface CapturedIndex {
    readonly index: SnapshotIndex;
    readonly path: string;
    readonly parent: PinnedDirectory;
    readonly identity: FileIdentity | null;
}

interface PathLists {
    readonly tracked: readonly string[];
    readonly untracked: readonly string[];
}

interface IndexLock {
    readonly path: string;
    readonly handle: Awaited<ReturnType<typeof open>>;
    readonly parent: PinnedDirectory;
}

function invalid(message: string): GitUtilityError {
    return new GitUtilityError("invalidInput", message);
}

function outputLimit(message: string): GitUtilityError {
    return new GitUtilityError("outputLimit", message);
}

function filesystemFailure(fallback: string): GitUtilityError {
    return new GitUtilityError("commandFailed", fallback);
}

function isErrno(error: unknown, code: string): boolean {
    return (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === code
    );
}

function assertNotAborted(signal: AbortSignal | undefined): void {
    if (signal?.aborted !== true) return;
    const suffix =
        signal.reason === "repositoryClosed"
            ? " because the repository closed"
            : "";
    throw new GitUtilityError(
        "commandFailed",
        `Recovery snapshot was cancelled${suffix}`,
    );
}

function encodedLength(bytes: number): number {
    return Math.ceil(bytes / 3) * 4;
}

function sha256(bytes: Buffer): string {
    return createHash("sha256").update(bytes).digest("hex");
}

interface DecodedBase64 {
    readonly value: Buffer;
}

function decodeCanonicalBase64(value: string): DecodedBase64 | null {
    const bytes = Buffer.from(value, "base64");
    return bytes.toString("base64") === value ? { value: bytes } : null;
}

function isSafeRepositoryPath(value: string): boolean {
    if (
        value.length === 0 ||
        value.length > MAX_PATH_CHARACTERS ||
        value.includes("\0") ||
        value.includes("\\") ||
        value.startsWith("/") ||
        value.endsWith("/")
    ) {
        return false;
    }
    const segments = value.split("/");
    return segments.every(
        (segment) =>
            segment.length > 0 &&
            segment !== "." &&
            segment !== ".." &&
            segment !== ".git",
    );
}

function validatePath(path: unknown): string {
    const parsed = SafePathSchema.safeParse(path);
    if (!parsed.success)
        throw invalid("Git returned an unsafe repository path");
    return parsed.data;
}

function pathDepth(path: string): number {
    return path.split("/").length;
}

function sortedUnique(values: readonly string[]): readonly string[] {
    return [...new Set(values)].sort();
}

function validateSortedUnique(
    values: readonly string[],
    path: readonly (string | number)[],
    context: z.RefinementCtx,
): void {
    const expected = sortedUnique(values);
    if (
        expected.length !== values.length ||
        expected.some((value, index) => value !== values[index])
    ) {
        context.addIssue({
            code: "custom",
            message: "Snapshot paths must be sorted and unique",
            path: [...path],
        });
    }
}

function hasPathPrefixConflict(paths: readonly string[]): boolean {
    const sorted = [...paths].sort();
    return sorted.some((path, index) => {
        const next = sorted[index + 1];
        return next !== undefined && next.startsWith(`${path}/`);
    });
}

function snapshotPayload(
    snapshot: RepositorySnapshot | (SnapshotPayload & { sha256?: string }),
): SnapshotPayload {
    return {
        version: SNAPSHOT_VERSION,
        trackedPaths: [...snapshot.trackedPaths],
        untrackedPaths: [...snapshot.untrackedPaths],
        files: snapshot.files.map((file) => ({ ...file })),
        index: { ...snapshot.index },
        totalBytes: snapshot.totalBytes,
    };
}

function createSnapshot(payload: SnapshotPayload): RepositorySnapshot {
    const bytes = Buffer.from(JSON.stringify(payload), "utf8");
    return { ...payload, sha256: sha256(bytes) };
}

export function copyRepositorySnapshot(
    snapshot: RepositorySnapshot,
): RepositorySnapshot {
    return createSnapshot(snapshotPayload(snapshot));
}

export type RepositorySnapshotFileContent =
    | Readonly<{ kind: "missing" }>
    | Readonly<{ kind: "binary" }>
    | Readonly<{ kind: "text"; content: string }>;

export function readRepositorySnapshotFile(
    snapshot: RepositorySnapshot,
    path: string,
): RepositorySnapshotFileContent {
    const parsedSnapshot = RepositorySnapshotSchema.parse(snapshot);
    const parsedPath = SafePathSchema.parse(path);
    const file = parsedSnapshot.files.find(
        (candidate) => candidate.path === parsedPath,
    );
    if (file === undefined) return { kind: "missing" };
    if (file.kind !== "file") return { kind: "binary" };
    const decoded = decodeCanonicalBase64(file.bytesBase64);
    if (decoded === null || !isUtf8(decoded.value)) return { kind: "binary" };
    return { kind: "text", content: decoded.value.toString("utf8") };
}

export function mergeRepositorySnapshotPaths(
    source: RepositorySnapshot,
    current: RepositorySnapshot,
    paths: readonly string[],
): RepositorySnapshot {
    const parsedSource = RepositorySnapshotSchema.parse(source);
    const parsedCurrent = RepositorySnapshotSchema.parse(current);
    const selectedPaths = new Set(paths.map((path) => SafePathSchema.parse(path)));
    const sourceFiles = new Map(
        parsedSource.files.map((file) => [file.path, file]),
    );
    const files = new Map(parsedCurrent.files.map((file) => [file.path, file]));
    const tracked = new Set(parsedCurrent.trackedPaths);
    const untracked = new Set(parsedCurrent.untrackedPaths);
    const sourceTracked = new Set(parsedSource.trackedPaths);
    const sourceUntracked = new Set(parsedSource.untrackedPaths);

    for (const path of selectedPaths) {
        files.delete(path);
        tracked.delete(path);
        untracked.delete(path);
        const sourceFile = sourceFiles.get(path);
        if (sourceFile !== undefined) files.set(path, sourceFile);
        if (sourceTracked.has(path)) tracked.add(path);
        if (sourceUntracked.has(path)) untracked.add(path);
    }

    const nextFiles = [...files.values()].sort((left, right) =>
        left.path.localeCompare(right.path),
    );
    const totalBytes = nextFiles.reduce((total, file) => {
        const decoded = decodeCanonicalBase64(file.bytesBase64);
        return total + (decoded?.value.byteLength ?? 0);
    }, parsedCurrent.index.kind === "file"
        ? (decodeCanonicalBase64(parsedCurrent.index.bytesBase64)?.value
              .byteLength ?? 0)
        : 0);
    return createSnapshot({
        version: SNAPSHOT_VERSION,
        trackedPaths: [...tracked].sort(),
        untrackedPaths: [...untracked].sort(),
        files: nextFiles,
        index: { ...parsedCurrent.index },
        totalBytes,
    });
}

function sameIdentity(metadata: Stats, identity: FileIdentity): boolean {
    return (
        metadata.dev === identity.device &&
        metadata.ino === identity.inode &&
        metadata.size === identity.size &&
        (metadata.mode & 0o777) === identity.mode &&
        metadata.mtimeMs === identity.modifiedMs &&
        metadata.ctimeMs === identity.changedMs
    );
}

function identityFrom(metadata: Stats): FileIdentity {
    return {
        device: metadata.dev,
        inode: metadata.ino,
        size: metadata.size,
        mode: metadata.mode & 0o777,
        modifiedMs: metadata.mtimeMs,
        changedMs: metadata.ctimeMs,
    };
}

async function optionalMetadata(
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

function sameDirectory(metadata: Stats, directory: PinnedDirectory): boolean {
    return (
        metadata.dev === directory.device && metadata.ino === directory.inode
    );
}

async function pinDirectory(
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
    if (
        canonicalMetadata.isSymbolicLink() ||
        !canonicalMetadata.isDirectory()
    ) {
        throw invalid(`${label} must remain a real directory`);
    }
    return {
        path: canonical,
        device: canonicalMetadata.dev,
        inode: canonicalMetadata.ino,
    };
}

async function assertPinnedDirectory(
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

async function syncDirectory(directory: PinnedDirectory): Promise<void> {
    await assertPinnedDirectory(directory, "Repository directory");
    const handle = await open(directory.path, constants.O_RDONLY).catch(() => {
        throw filesystemFailure(
            "Repository directory could not be synchronized",
        );
    });
    try {
        await handle.sync().catch(() => {
            throw filesystemFailure(
                "Repository directory could not be synchronized",
            );
        });
    } finally {
        await handle.close().catch(() => undefined);
    }
}

function containedPath(root: string, candidate: string): boolean {
    const result = relative(root, candidate);
    return (
        result === "" ||
        (!result.startsWith(`..${sep}`) &&
            result !== ".." &&
            !isAbsolute(result))
    );
}

async function repositoryDirectories(repository: RepositoryRecord): Promise<{
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

function outcomeText(
    outcome: GitProcessOutcome,
    stream: "stdout" | "stderr",
): string {
    return outcome.output
        .filter((entry) => entry.stream === stream)
        .map((entry) => entry.data)
        .join("");
}

function processFailure(
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

async function captureGitText(
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

function parseNulPaths(value: string | null): readonly string[] {
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

async function capturePathLists(
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

async function pathParents(
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

async function assertParents(
    parents: readonly PinnedDirectory[],
): Promise<void> {
    for (const parent of parents)
        await assertPinnedDirectory(parent, "Repository path parent");
}

async function readRegularFile(
    path: string,
    metadata: Stats,
    maximumBytes: number,
): Promise<{ readonly bytes: Buffer; readonly identity: FileIdentity }> {
    if (
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        metadata.nlink !== 1
    ) {
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
            throw invalid(
                "Recovery snapshot file changed before it could be read",
            );
        }
        const bytes = await handle.readFile();
        if (bytes.byteLength > maximumBytes) {
            throw outputLimit("Recovery snapshot file exceeds its byte limit");
        }
        const after = await handle.stat();
        if (!sameIdentity(after, before)) {
            throw invalid(
                "Recovery snapshot file changed while it was being read",
            );
        }
        return { bytes, identity: before };
    } finally {
        await handle.close().catch(() => undefined);
    }
}

async function capturePath(
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
            throw outputLimit(
                "Recovery snapshot symlink exceeds its byte limit",
            );
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

async function assertCapturedPath(
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

async function captureIndex(git: PinnedDirectory): Promise<CapturedIndex> {
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

async function assertCapturedIndex(index: CapturedIndex): Promise<void> {
    await assertPinnedDirectory(index.parent, "Repository Git directory");
    const existing = await optionalMetadata(index.path, "Repository index");
    if (
        (index.identity === null && existing !== null) ||
        (index.identity !== null &&
            (existing === null ||
                !sameIdentity(existing.value, index.identity)))
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

function samePathLists(left: PathLists, right: PathLists): boolean {
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
    const initialPaths = await capturePathLists(
        runner,
        repository.path,
        signal,
    );
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
        if (bytes === null)
            throw invalid("Captured snapshot bytes are invalid");
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
        const indexBytes = decodeCanonicalBase64(
            capturedIndex.index.bytesBase64,
        );
        if (indexBytes === null)
            throw invalid("Captured index bytes are invalid");
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

function sameSnapshot(
    left: RepositorySnapshot,
    right: RepositorySnapshot,
): boolean {
    return left.sha256 === right.sha256;
}

export function repositorySnapshotsEqual(
    left: RepositorySnapshot,
    right: RepositorySnapshot,
): boolean {
    return sameSnapshot(left, right);
}

function sameSnapshotFile(left: SnapshotFile, right: SnapshotFile): boolean {
    return (
        left.path === right.path &&
        left.kind === right.kind &&
        left.mode === right.mode &&
        left.sha256 === right.sha256 &&
        left.bytesBase64 === right.bytesBase64
    );
}

async function assertStoredFile(
    root: PinnedDirectory,
    expected: SnapshotFile,
): Promise<void> {
    const captured = await capturePath(root, expected.path);
    if (captured === null || !sameSnapshotFile(captured.file, expected)) {
        throw invalid("Repository file changed during recovery");
    }
}

async function inspectConflictDirectory(
    root: PinnedDirectory,
    relativePath: string,
    currentFiles: ReadonlyMap<string, SnapshotFile>,
    directories: Set<string>,
    visited: { count: number },
): Promise<void> {
    if (visited.count > MAX_RECOVERY_SNAPSHOT_FILES) {
        throw outputLimit(
            "Recovery directory preflight exceeds its file limit",
        );
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
        if (
            entry.name.includes("/") ||
            entry.name === "." ||
            entry.name === ".."
        ) {
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
            throw invalid(
                "Recovery directory contains an unsupported file type",
            );
        }
        if (!currentFiles.has(childPath)) {
            throw invalid("Recovery would overwrite an unmanaged file");
        }
    }
    await assertPinnedDirectory(pinned, "Recovery conflict directory");
}

async function preflightTopology(
    root: PinnedDirectory,
    target: RepositorySnapshot,
    current: RepositorySnapshot,
): Promise<readonly string[]> {
    const targetFiles = new Map(target.files.map((file) => [file.path, file]));
    const currentFiles = new Map(
        current.files.map((file) => [file.path, file]),
    );
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
                throw invalid(
                    "Recovery path has an unmanaged or unsafe parent",
                );
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
                { count: 0 },
            );
        } else if (!currentFiles.has(targetFile.path)) {
            throw invalid("Recovery would overwrite an unmanaged file");
        }
    }
    return [...conflictDirectories].sort(
        (left, right) => pathDepth(right) - pathDepth(left),
    );
}

async function safeUnlink(
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

async function ensureParentDirectories(
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
                throw filesystemFailure(
                    "Repository directory could not be created",
                );
            });
            await syncDirectory(current);
            metadata = await lstat(childPath).catch(() => {
                throw filesystemFailure(
                    "Repository directory is not accessible",
                );
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

async function writeSnapshotFile(
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
                throw filesystemFailure(
                    "Recovery temporary file could not be created",
                );
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

async function acquireIndexLock(
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

async function captureIndexWithExistingLock(
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

function sameSnapshotIndex(left: SnapshotIndex, right: SnapshotIndex): boolean {
    if (left.kind !== right.kind) return false;
    if (left.kind === "missing" || right.kind === "missing") return true;
    return (
        left.mode === right.mode &&
        left.sha256 === right.sha256 &&
        left.bytesBase64 === right.bytesBase64
    );
}

async function commitIndexLock(
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
            await assertPinnedDirectory(
                lock.parent,
                "Repository Git directory",
            );
            await rename(lock.path, indexPath).catch(() => {
                throw filesystemFailure("Recovery index could not be replaced");
            });
        } else {
            await lock.handle.sync();
            await lock.handle.close();
            const existing = await optionalMetadata(
                indexPath,
                "Repository index",
            );
            if (existing !== null) {
                if (
                    existing.value.isSymbolicLink() ||
                    !existing.value.isFile() ||
                    existing.value.nlink !== 1
                ) {
                    throw invalid(
                        "Repository index became unsafe during recovery",
                    );
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

async function releaseIndexLock(lock: IndexLock): Promise<void> {
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
            .sort(
                (left, right) => pathDepth(right.path) - pathDepth(left.path),
            );
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
            throw invalid(
                "Repository snapshot verification failed after recovery",
            );
        }
    }
}
