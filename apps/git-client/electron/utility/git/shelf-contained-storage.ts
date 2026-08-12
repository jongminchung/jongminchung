import { Buffer } from "node:buffer";
import { constants } from "node:fs";
import type { Stats } from "node:fs";
import { lstat, mkdir, open, realpath, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { RepositoryRecord } from "../../../src/shared/contracts/git-utility";
import { GitUtilityError } from "./git-error";
import { safeErrorMessage } from "./redaction";
import { shelfPathComponents } from "./shelf-manifest";

export interface PinnedShelfDirectory {
    readonly path: string;
    readonly device: number;
    readonly inode: number;
}

export interface ShelfFileIdentity {
    readonly device: number;
    readonly inode: number;
    readonly size: number;
}

export interface ContainedShelfFile {
    readonly bytes: Buffer;
    readonly identity: ShelfFileIdentity;
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

export function sameShelfIdentity(
    metadata: Stats,
    pinned: PinnedShelfDirectory | ShelfFileIdentity,
): boolean {
    return metadata.dev === pinned.device && metadata.ino === pinned.inode;
}

function directoryFrom(path: string, metadata: Stats): PinnedShelfDirectory {
    return { path, device: metadata.dev, inode: metadata.ino };
}

function fileIdentity(metadata: Stats): ShelfFileIdentity {
    return { device: metadata.dev, inode: metadata.ino, size: metadata.size };
}

export async function pinShelfDirectory(
    path: string,
    label: string,
): Promise<PinnedShelfDirectory> {
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
        !canonicalMetadata.isDirectory() ||
        canonicalMetadata.isSymbolicLink()
    ) {
        throw invalid(`${label} must remain a real directory`);
    }
    return directoryFrom(canonical, canonicalMetadata);
}

export async function assertPinnedShelfDirectory(
    directory: PinnedShelfDirectory,
    label: string,
): Promise<void> {
    const metadata = await lstat(directory.path).catch((error: unknown) => {
        throw filesystemError(error, `${label} changed during the operation`);
    });
    if (
        metadata.isSymbolicLink() ||
        !metadata.isDirectory() ||
        !sameShelfIdentity(metadata, directory)
    ) {
        throw invalid(`${label} changed during the operation`);
    }
}

export async function optionalShelfChildDirectory(
    parent: PinnedShelfDirectory,
    name: string,
    label: string,
): Promise<PinnedShelfDirectory | null> {
    await assertPinnedShelfDirectory(parent, "Shelf parent directory");
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
    const child = await pinShelfDirectory(candidate, label);
    if (dirname(child.path) !== parent.path)
        throw invalid(`${label} must stay inside its parent`);
    await assertPinnedShelfDirectory(parent, "Shelf parent directory");
    return child;
}

export async function ensureShelfChildDirectory(
    parent: PinnedShelfDirectory,
    name: string,
    label: string,
): Promise<PinnedShelfDirectory> {
    const existing = await optionalShelfChildDirectory(parent, name, label);
    if (existing !== null) return existing;
    await assertPinnedShelfDirectory(parent, "Shelf parent directory");
    try {
        await mkdir(join(parent.path, name), { mode: 0o700 });
    } catch (error) {
        if (!isErrno(error, "EEXIST"))
            throw filesystemError(error, `Unable to create ${label}`);
    }
    const child = await optionalShelfChildDirectory(parent, name, label);
    if (child === null)
        throw invalid(`${label} disappeared while it was being created`);
    return child;
}

export async function pinShelfRepository(
    repository: RepositoryRecord,
): Promise<PinnedShelfDirectory> {
    if (repository.isBare) throw invalid("Shelves require a working tree");
    const pinned = await pinShelfDirectory(repository.path, "Repository root");
    if (pinned.path !== repository.path) {
        throw new GitUtilityError(
            "repositoryNotOpen",
            "Canonical repository path changed",
        );
    }
    return pinned;
}

export async function walkExistingShelfParent(
    root: PinnedShelfDirectory,
    components: readonly string[],
    label: string,
): Promise<PinnedShelfDirectory> {
    let current = root;
    for (const component of components) {
        const child = await optionalShelfChildDirectory(
            current,
            component,
            label,
        );
        if (child === null) throw invalid(`${label} is missing`);
        current = child;
    }
    return current;
}

export async function ensureShelfParent(
    root: PinnedShelfDirectory,
    components: readonly string[],
    label: string,
): Promise<PinnedShelfDirectory> {
    let current = root;
    for (const component of components) {
        current = await ensureShelfChildDirectory(current, component, label);
    }
    return current;
}

export async function readContainedShelfFile(
    root: PinnedShelfDirectory,
    relativePath: string,
    maximumBytes: number,
    label: string,
): Promise<ContainedShelfFile> {
    const components = shelfPathComponents(relativePath);
    const parent = await walkExistingShelfParent(
        root,
        components.slice(0, -1),
        label,
    );
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
    if (before.size > maximumBytes)
        throw new GitUtilityError("outputLimit", `${label} is too large`);
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
        if (
            !opened.isFile() ||
            !sameShelfIdentity(opened, fileIdentity(before))
        ) {
            throw invalid(`${label} changed before it could be read`);
        }
        const chunks: Buffer[] = [];
        let total = 0;
        while (true) {
            const chunk = Buffer.allocUnsafe(
                Math.min(64 * 1024, maximumBytes - total + 1),
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
            if (total > maximumBytes)
                throw new GitUtilityError(
                    "outputLimit",
                    `${label} is too large`,
                );
        }
        const after = await lstat(path).catch(() => null);
        if (
            after === null ||
            after.isSymbolicLink() ||
            !after.isFile() ||
            !sameShelfIdentity(after, fileIdentity(opened))
        ) {
            throw invalid(`${label} changed while it was being read`);
        }
        await assertPinnedShelfDirectory(parent, `${label} parent`);
        return {
            bytes: Buffer.concat(chunks, total),
            identity: fileIdentity(opened),
        };
    } finally {
        await handle.close().catch(() => undefined);
    }
}

export async function writeContainedShelfFile(
    root: PinnedShelfDirectory,
    relativePath: string,
    bytes: Buffer,
    label: string,
    mode = 0o600,
): Promise<ShelfFileIdentity> {
    const components = shelfPathComponents(relativePath);
    const parent = await ensureShelfParent(
        root,
        components.slice(0, -1),
        `${label} parent`,
    );
    const path = join(parent.path, components.at(-1) as string);
    let handle;
    try {
        handle = await open(
            path,
            constants.O_WRONLY |
                constants.O_CREAT |
                constants.O_EXCL |
                constants.O_NOFOLLOW,
            mode,
        );
    } catch (error) {
        throw invalid(
            `${label} could not be created safely (${safeErrorMessage(error instanceof Error ? error.message : "open failed")})`,
        );
    }
    let identity: ShelfFileIdentity;
    try {
        await handle.writeFile(bytes);
        await handle.sync();
        const metadata = await handle.stat();
        if (!metadata.isFile())
            throw invalid(`${label} did not remain a regular file`);
        identity = fileIdentity(metadata);
    } finally {
        await handle.close().catch(() => undefined);
    }
    const finalMetadata = await lstat(path).catch(() => null);
    if (
        finalMetadata === null ||
        finalMetadata.isSymbolicLink() ||
        !finalMetadata.isFile() ||
        !sameShelfIdentity(finalMetadata, identity)
    ) {
        throw invalid(`${label} changed while it was being written`);
    }
    await assertPinnedShelfDirectory(parent, `${label} parent`);
    return identity;
}

export async function syncShelfDirectory(
    directory: PinnedShelfDirectory,
): Promise<void> {
    await assertPinnedShelfDirectory(directory, "Shelf directory");
    const handle = await open(directory.path, constants.O_RDONLY).catch(
        (error: unknown) => {
            throw filesystemError(
                error,
                "Shelf directory could not be opened for synchronization",
            );
        },
    );
    try {
        await handle.sync().catch((error: unknown) => {
            throw filesystemError(
                error,
                "Shelf directory could not be synchronized",
            );
        });
    } finally {
        await handle.close().catch(() => undefined);
    }
}

export async function removePinnedShelfDirectory(
    parent: PinnedShelfDirectory,
    directory: PinnedShelfDirectory,
): Promise<void> {
    await assertPinnedShelfDirectory(parent, "Shelf parent directory");
    await assertPinnedShelfDirectory(directory, "Shelf directory");
    if (dirname(directory.path) !== parent.path)
        throw invalid("Shelf directory escaped its parent");
    await rm(directory.path, { recursive: true, force: false }).catch(
        (error: unknown) => {
            throw filesystemError(
                error,
                "Shelf directory could not be removed",
            );
        },
    );
    await syncShelfDirectory(parent);
}
