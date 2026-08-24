import { Buffer, isUtf8 } from "node:buffer";
import { createHash } from "node:crypto";
import { normalize, sep } from "node:path";
import { z } from "zod";
import type { RepositoryId } from "../../../src/shared/contracts/git-utility";
import type { ShelfEntry } from "../../../src/shared/contracts/model";
import { GitUtilityError } from "./git-error";
import { validateRelativePath } from "./validation";

export const MAX_SHELF_MESSAGE_BYTES = 1024 * 1024;
export const MAX_SHELF_MANIFEST_BYTES = 2 * 1024 * 1024;
export const MAX_SHELF_PATHS = 10_000;

const UuidSchema = z.uuid();
const ChecksumSchema = z.string().regex(/^[0-9a-f]{64}$/u);
const ShelfFileSchema = z
  .object({
    path: z.string().min(1).max(16_384),
    checksum: z.string().max(64),
    untracked: z.boolean(),
  })
  .strict();
const ShelfEntrySchema = z
  .object({
    id: UuidSchema,
    repositoryId: UuidSchema,
    message: z.string().max(MAX_SHELF_MESSAGE_BYTES),
    createdAtMs: z.number().int().nonnegative().safe(),
    files: z.array(ShelfFileSchema).max(MAX_SHELF_PATHS),
    indexPatchChecksum: ChecksumSchema,
    worktreePatchChecksum: ChecksumSchema,
  })
  .strict();
const ShelfManifestSchema = z.object({ entry: ShelfEntrySchema }).strict();

export interface ShelfCreateInput {
  readonly message: string;
  readonly paths: readonly string[];
}

function invalid(message: string): GitUtilityError {
  return new GitUtilityError("invalidInput", message);
}

export function shelfChecksum(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function validateShelfId(untrustedShelfId: unknown): string {
  const result = UuidSchema.safeParse(untrustedShelfId);
  if (!result.success) throw invalid("Shelf id must be a UUID");
  return result.data;
}

export function isShelfId(value: unknown): value is string {
  return UuidSchema.safeParse(value).success;
}

export function validateShelfRepositoryId(
  untrustedRepositoryId: unknown,
): RepositoryId {
  const result = UuidSchema.safeParse(untrustedRepositoryId);
  if (!result.success) throw invalid("Repository id must be a UUID");
  return result.data as RepositoryId;
}

export function shelfPathComponents(untrustedPath: unknown): readonly string[] {
  if (typeof untrustedPath !== "string")
    throw invalid("Every shelf path must be a string");
  validateRelativePath(untrustedPath);
  const normalized = normalize(untrustedPath);
  const components = untrustedPath.split(sep);
  if (
    normalized !== untrustedPath ||
    components.some(
      (component) =>
        component.length === 0 || component === "." || component === "..",
    )
  ) {
    throw invalid("Shelf paths must be normalized relative paths");
  }
  return Object.freeze(components);
}

export function validateShelfCreateInput(
  untrustedMessage: unknown,
  untrustedPaths: unknown,
): ShelfCreateInput {
  if (typeof untrustedMessage !== "string")
    throw invalid("Shelf message must be a string");
  if (
    untrustedMessage.includes("\0") ||
    Buffer.byteLength(untrustedMessage, "utf8") > MAX_SHELF_MESSAGE_BYTES
  ) {
    throw invalid("Shelf message must not contain NUL or exceed 1 MiB");
  }
  if (
    !Array.isArray(untrustedPaths) ||
    untrustedPaths.length < 1 ||
    untrustedPaths.length > MAX_SHELF_PATHS
  ) {
    throw invalid(`Shelf paths must contain 1 to ${MAX_SHELF_PATHS} entries`);
  }
  const paths: string[] = [];
  const seen = new Set<string>();
  for (const untrustedPath of untrustedPaths) {
    shelfPathComponents(untrustedPath);
    const path = untrustedPath as string;
    if (!seen.has(path)) {
      seen.add(path);
      paths.push(path);
    }
  }
  return {
    message:
      untrustedMessage.trim().length === 0
        ? "Shelved changes"
        : untrustedMessage,
    paths: Object.freeze(paths),
  };
}

export function parseShelfUntrackedPaths(bytes: Buffer): readonly string[] {
  if (!isUtf8(bytes)) throw invalid("Git returned a non-UTF-8 untracked path");
  const paths = bytes
    .toString("utf8")
    .split("\0")
    .filter((path) => path.length > 0);
  if (paths.length > MAX_SHELF_PATHS) {
    throw new GitUtilityError(
      "outputLimit",
      `Shelf contains more than ${MAX_SHELF_PATHS} paths`,
    );
  }
  const unique = new Set<string>();
  for (const path of paths) {
    shelfPathComponents(path);
    unique.add(path);
  }
  return Object.freeze([...unique].sort());
}

export function validateShelfManifestEntry(
  untrusted: unknown,
  repositoryId: RepositoryId,
  shelfId: string,
): ShelfEntry {
  const parsed = ShelfManifestSchema.safeParse(untrusted);
  if (!parsed.success) throw invalid("Shelf manifest is invalid");
  const entry = parsed.data.entry;
  if (entry.id !== shelfId || entry.repositoryId !== repositoryId) {
    throw invalid("Shelf manifest identity does not match its directory");
  }
  if (
    entry.message.includes("\0") ||
    Buffer.byteLength(entry.message, "utf8") > MAX_SHELF_MESSAGE_BYTES
  ) {
    throw invalid("Shelf manifest message is invalid");
  }
  const seen = new Set<string>();
  for (const file of entry.files) {
    shelfPathComponents(file.path);
    if (seen.has(file.path))
      throw invalid("Shelf manifest contains duplicate paths");
    seen.add(file.path);
    if (file.untracked) {
      if (!ChecksumSchema.safeParse(file.checksum).success) {
        throw invalid(`Shelf checksum is invalid for ${file.path}`);
      }
    } else if (file.checksum !== "") {
      throw invalid(
        `Tracked shelf path must not contain a file checksum (${file.path})`,
      );
    }
  }
  return {
    ...entry,
    repositoryId: entry.repositoryId as RepositoryId,
    files: entry.files.map((file) => ({ ...file })),
  };
}
