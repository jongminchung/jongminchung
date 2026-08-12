import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import type { Stats } from "node:fs";
import { normalize, sep } from "node:path";
import { z } from "zod";
import {
    RepositoryIdSchema,
    type RepositoryId,
    type RepositoryRecord,
} from "../../../src/shared/contracts/git-utility";
import type {
    Changelist,
    ChangelistCommitOptions,
} from "../../../src/shared/contracts/model";
import { GitUtilityError } from "./git-error";
import { safeErrorMessage } from "./redaction";
import { validateRelativePath } from "./validation";

export const MAX_CHANGELISTS = 10_000;
export const MAX_CHANGELIST_PATHS = 10_000;
export const MAX_CHANGELIST_MANIFEST_BYTES = 16 * 1024 * 1024;

export const MAX_CHANGELIST_NAME_BYTES = 1024 * 1024;
export const MAX_CHANGELIST_PATH_BYTES = 1024 * 1024;
export const MAX_GIT_OUTPUT_BYTES = 16 * 1024 * 1024;
export const MAX_GIT_DIAGNOSTIC_BYTES = 1024 * 1024;
export const MAX_INDEX_BYTES = 256 * 1024 * 1024;
export const MANIFEST_VERSION = 1;
export const MANIFEST_DIRECTORY = "changelists";

export const UuidSchema = z.uuid();
export const ObjectIdSchema = z
    .string()
    .regex(/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/u);
export const ChecksumSchema = z.string().regex(/^[0-9a-f]{64}$/u);
export const PersistedChangelistSchema = z
    .object({
        id: UuidSchema,
        repositoryId: UuidSchema,
        name: z.string().min(1).max(MAX_CHANGELIST_NAME_BYTES),
        paths: z.array(z.string().min(1).max(16_384)).max(MAX_CHANGELIST_PATHS),
        createdAtMs: z.number().int().nonnegative().safe(),
        updatedAtMs: z.number().int().nonnegative().safe(),
    })
    .strict();
export const ManifestPayloadSchema = z
    .object({
        version: z.literal(MANIFEST_VERSION),
        repositoryId: UuidSchema,
        changelists: z.array(PersistedChangelistSchema).max(MAX_CHANGELISTS),
    })
    .strict();
export const ManifestEnvelopeSchema = ManifestPayloadSchema.extend({
    checksum: ChecksumSchema,
}).strict();
export const CommitOptionsSchema = z
    .object({
        message: z.string().min(1).max(MAX_CHANGELIST_NAME_BYTES),
        amend: z.boolean(),
        signOff: z.boolean(),
        gpgSign: z.boolean(),
    })
    .strict();

export interface ManifestPayload {
    readonly version: typeof MANIFEST_VERSION;
    readonly repositoryId: RepositoryId;
    readonly changelists: readonly Changelist[];
}

export interface PinnedDirectory {
    readonly path: string;
    readonly device: number;
    readonly inode: number;
}

export interface FileIdentity {
    readonly device: number;
    readonly inode: number;
    readonly size: number;
}

export interface IndexBackupBase {
    readonly path: string;
    readonly parent: PinnedDirectory;
}

export interface MissingIndexBackup extends IndexBackupBase {
    readonly kind: "missing";
}

export interface PresentIndexBackup extends IndexBackupBase {
    readonly kind: "present";
    readonly bytes: Buffer;
    readonly mode: number;
}

export type IndexBackup = MissingIndexBackup | PresentIndexBackup;

export type OptionalBytes =
    | Readonly<{ kind: "missing" }>
    | Readonly<{ kind: "present"; bytes: Buffer }>;

export interface OriginalHead {
    readonly oid: string | null;
    readonly symbolicRef: string | null;
}

export interface SaveInput {
    readonly id: string | null;
    readonly name: string;
    readonly paths: readonly string[];
}

export interface ChangelistRepositoryRegistryLike {
    get(repositoryId: RepositoryId): RepositoryRecord;
}

export function invalid(message: string): GitUtilityError {
    return new GitUtilityError("invalidInput", message);
}

export function isErrno(error: unknown, code: string): boolean {
    return (
        error instanceof Error &&
        "code" in error &&
        (error as NodeJS.ErrnoException).code === code
    );
}

export function filesystemError(
    error: unknown,
    fallback: string,
): GitUtilityError {
    if (error instanceof GitUtilityError) return error;
    const detail = error instanceof Error ? error.message : fallback;
    return new GitUtilityError("commandFailed", safeErrorMessage(detail));
}

export function sameIdentity(
    metadata: Stats,
    identity: PinnedDirectory | FileIdentity,
): boolean {
    return metadata.dev === identity.device && metadata.ino === identity.inode;
}

export function pinnedDirectory(
    path: string,
    metadata: Stats,
): PinnedDirectory {
    return { path, device: metadata.dev, inode: metadata.ino };
}

export function fileIdentity(metadata: Stats): FileIdentity {
    return { device: metadata.dev, inode: metadata.ino, size: metadata.size };
}

export function checksum(bytes: Buffer): string {
    return createHash("sha256").update(bytes).digest("hex");
}

export function compareUtf8(left: string, right: string): number {
    return Buffer.compare(
        Buffer.from(left, "utf8"),
        Buffer.from(right, "utf8"),
    );
}

export function payloadBytes(payload: ManifestPayload): Buffer {
    return Buffer.from(JSON.stringify(payload), "utf8");
}

export function encodedManifest(payload: ManifestPayload): Buffer {
    if (!ManifestPayloadSchema.safeParse(payload).success) {
        throw invalid("Changelist manifest payload is invalid");
    }
    const envelope = {
        ...payload,
        checksum: checksum(payloadBytes(payload)),
    };
    const bytes = Buffer.from(JSON.stringify(envelope, null, 2), "utf8");
    if (bytes.byteLength > MAX_CHANGELIST_MANIFEST_BYTES) {
        throw new GitUtilityError(
            "outputLimit",
            "Changelist manifest exceeds 16 MiB",
        );
    }
    return bytes;
}

export function assertNotAborted(signal: AbortSignal | undefined): void {
    if (signal?.aborted !== true) return;
    const suffix =
        signal.reason === "repositoryClosed"
            ? " because the repository closed"
            : "";
    throw new GitUtilityError(
        "commandFailed",
        `Changelist command cancelled${suffix}`,
    );
}

export function validateRepositoryId(untrusted: unknown): RepositoryId {
    const result = RepositoryIdSchema.safeParse(untrusted);
    if (!result.success) throw invalid("Repository id must be a UUID");
    return result.data;
}

export function validateChangelistId(untrusted: unknown): string {
    const result = UuidSchema.safeParse(untrusted);
    if (!result.success) throw invalid("Changelist id must be a UUID");
    return result.data;
}

export function normalizedPath(untrusted: unknown): string {
    if (typeof untrusted !== "string") {
        throw invalid("Every changelist path must be a string");
    }
    validateRelativePath(untrusted);
    const normalized = normalize(untrusted);
    const components = untrusted.split(sep);
    if (
        normalized !== untrusted ||
        components.some(
            (component) =>
                component.length === 0 ||
                component === "." ||
                component === "..",
        )
    ) {
        throw invalid("Changelist paths must be normalized relative paths");
    }
    return untrusted;
}

export function validatePaths(untrusted: unknown): readonly string[] {
    if (!Array.isArray(untrusted) || untrusted.length > MAX_CHANGELIST_PATHS) {
        throw invalid(
            `Changelist paths must contain at most ${MAX_CHANGELIST_PATHS} entries`,
        );
    }
    const paths = new Set<string>();
    let totalBytes = 0;
    for (const value of untrusted) {
        const path = normalizedPath(value);
        totalBytes += Buffer.byteLength(path, "utf8");
        if (totalBytes > MAX_CHANGELIST_PATH_BYTES) {
            throw new GitUtilityError(
                "outputLimit",
                "Changelist paths exceed 1 MiB",
            );
        }
        paths.add(path);
    }
    return Object.freeze([...paths].sort(compareUtf8));
}

export function validateSaveInput(
    untrustedId: unknown,
    untrustedName: unknown,
    untrustedPaths: unknown,
): SaveInput {
    if (untrustedId !== null && typeof untrustedId !== "string") {
        throw invalid("Changelist id must be null or a UUID");
    }
    const id = untrustedId === null ? null : validateChangelistId(untrustedId);
    if (typeof untrustedName !== "string") {
        throw invalid("Changelist name must be a string");
    }
    const name = untrustedName.trim();
    if (
        name.length === 0 ||
        name.includes("\0") ||
        Buffer.byteLength(name, "utf8") > MAX_CHANGELIST_NAME_BYTES
    ) {
        throw invalid(
            "Changelist name must be non-empty, contain no NUL, and not exceed 1 MiB",
        );
    }
    return { id, name, paths: validatePaths(untrustedPaths) };
}

export function validateCommitOptions(
    untrusted: unknown,
): ChangelistCommitOptions {
    const result = CommitOptionsSchema.safeParse(untrusted);
    if (!result.success) throw invalid("Changelist commit options are invalid");
    if (
        result.data.message.trim().length === 0 ||
        result.data.message.includes("\0")
    ) {
        throw invalid("Commit message must be non-empty and contain no NUL");
    }
    return result.data;
}

export function cloneChangelist(changelist: Changelist): Changelist {
    return { ...changelist, paths: [...changelist.paths] };
}

export function clonePayload(payload: ManifestPayload): ManifestPayload {
    return {
        version: MANIFEST_VERSION,
        repositoryId: payload.repositoryId,
        changelists: payload.changelists.map(cloneChangelist),
    };
}

export function validatePayload(
    untrusted: unknown,
    repositoryId: RepositoryId,
): ManifestPayload {
    const parsed = ManifestEnvelopeSchema.safeParse(untrusted);
    if (!parsed.success) throw invalid("Changelist manifest is invalid");
    const { checksum: storedChecksum, ...rawPayload } = parsed.data;
    const payload: ManifestPayload = {
        version: MANIFEST_VERSION,
        repositoryId: rawPayload.repositoryId,
        changelists: rawPayload.changelists.map((item) => ({
            ...item,
            paths: [...item.paths],
        })),
    };
    if (payload.repositoryId !== repositoryId) {
        throw invalid("Changelist manifest repository identity does not match");
    }
    if (checksum(payloadBytes(payload)) !== storedChecksum) {
        throw invalid("Changelist manifest checksum mismatch");
    }
    const ids = new Set<string>();
    for (const changelist of payload.changelists) {
        if (changelist.repositoryId !== repositoryId) {
            throw invalid("Changelist repository identity does not match");
        }
        if (ids.has(changelist.id)) {
            throw invalid("Changelist manifest contains duplicate ids");
        }
        ids.add(changelist.id);
        if (
            changelist.name.trim() !== changelist.name ||
            changelist.name.includes("\0") ||
            changelist.updatedAtMs < changelist.createdAtMs
        ) {
            throw invalid("Changelist manifest contains an invalid entry");
        }
        const paths = validatePaths(changelist.paths);
        if (
            paths.length !== changelist.paths.length ||
            paths.some((path, index) => path !== changelist.paths[index])
        ) {
            throw invalid(
                "Changelist manifest paths are not sorted and unique",
            );
        }
    }
    return clonePayload(payload);
}
