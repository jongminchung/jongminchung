import { Buffer, isUtf8 } from "node:buffer";
import { createHash } from "node:crypto";
import { z } from "zod";
import { GitUtilityError } from "./git-error";

export const MAX_RECOVERY_SNAPSHOT_FILES = 20_000;
export const MAX_RECOVERY_SNAPSHOT_FILE_BYTES = 16 * 1024 * 1024;
export const MAX_RECOVERY_SNAPSHOT_BYTES = 64 * 1024 * 1024;

export const MAX_INDEX_BYTES = 64 * 1024 * 1024;
export const MAX_PATH_BYTES = 8 * 1024 * 1024;
export const MAX_PATH_CHARACTERS = 16_384;
export const SNAPSHOT_VERSION = 1;

export const ChecksumSchema = z.string().regex(/^[0-9a-f]{64}$/u);
export const SafePathSchema = z
  .string()
  .min(1)
  .max(MAX_PATH_CHARACTERS)
  .refine(isSafeRepositoryPath, "Repository snapshot path is unsafe");

export const SnapshotFileSchema = z
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

export const SnapshotIndexSchema = z.discriminatedUnion("kind", [
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

export const RepositorySnapshotPayloadSchema = z
  .object({
    version: z.literal(SNAPSHOT_VERSION),
    trackedPaths: z.array(SafePathSchema).max(MAX_RECOVERY_SNAPSHOT_FILES),
    untrackedPaths: z.array(SafePathSchema).max(MAX_RECOVERY_SNAPSHOT_FILES),
    files: z.array(SnapshotFileSchema).max(MAX_RECOVERY_SNAPSHOT_FILES),
    index: SnapshotIndexSchema,
    totalBytes: z.number().int().nonnegative().max(MAX_RECOVERY_SNAPSHOT_BYTES),
  })
  .strict()
  .superRefine((snapshot, context) => {
    validateSortedUnique(snapshot.trackedPaths, ["trackedPaths"], context);
    validateSortedUnique(snapshot.untrackedPaths, ["untrackedPaths"], context);
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
        (decodeCanonicalBase64(file.bytesBase64)?.value.byteLength ?? 0),
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
      sha256(Buffer.from(JSON.stringify(payload), "utf8")) !== snapshot.sha256
    ) {
      context.addIssue({
        code: "custom",
        message: "Repository snapshot checksum mismatch",
      });
    }
  });

export type RepositorySnapshot = z.infer<typeof RepositorySnapshotSchema>;
export type SnapshotFile = z.infer<typeof SnapshotFileSchema>;
export type SnapshotIndex = z.infer<typeof SnapshotIndexSchema>;
export type SnapshotPayload = z.infer<typeof RepositorySnapshotPayloadSchema>;

export function invalid(message: string): GitUtilityError {
  return new GitUtilityError("invalidInput", message);
}

export function outputLimit(message: string): GitUtilityError {
  return new GitUtilityError("outputLimit", message);
}

export function filesystemFailure(fallback: string): GitUtilityError {
  return new GitUtilityError("commandFailed", fallback);
}

export function isErrno(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}

export function assertNotAborted(signal: AbortSignal | undefined): void {
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

export function encodedLength(bytes: number): number {
  return Math.ceil(bytes / 3) * 4;
}

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export interface DecodedBase64 {
  readonly value: Buffer;
}

export function decodeCanonicalBase64(value: string): DecodedBase64 | null {
  const bytes = Buffer.from(value, "base64");
  return bytes.toString("base64") === value ? { value: bytes } : null;
}

export function isSafeRepositoryPath(value: string): boolean {
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

export function validatePath(path: unknown): string {
  const parsed = SafePathSchema.safeParse(path);
  if (!parsed.success) throw invalid("Git returned an unsafe repository path");
  return parsed.data;
}

export function pathDepth(path: string): number {
  return path.split("/").length;
}

export function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort();
}

export function validateSortedUnique(
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

export function hasPathPrefixConflict(paths: readonly string[]): boolean {
  const sorted = [...paths].sort();
  return sorted.some((path, index) => {
    const next = sorted[index + 1];
    return next !== undefined && next.startsWith(`${path}/`);
  });
}

export function snapshotPayload(
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

export function createSnapshot(payload: SnapshotPayload): RepositorySnapshot {
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
  const selectedPaths = new Set(
    paths.map((path) => SafePathSchema.parse(path)),
  );
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
  const totalBytes = nextFiles.reduce(
    (total, file) => {
      const decoded = decodeCanonicalBase64(file.bytesBase64);
      return total + (decoded?.value.byteLength ?? 0);
    },
    parsedCurrent.index.kind === "file"
      ? (decodeCanonicalBase64(parsedCurrent.index.bytesBase64)?.value
          .byteLength ?? 0)
      : 0,
  );
  return createSnapshot({
    version: SNAPSHOT_VERSION,
    trackedPaths: [...tracked].sort(),
    untrackedPaths: [...untracked].sort(),
    files: nextFiles,
    index: { ...parsedCurrent.index },
    totalBytes,
  });
}

export function sameSnapshot(
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
