import { Buffer, isUtf8 } from "node:buffer";
import { createHash } from "node:crypto";
import { z } from "zod";
import { RepositoryIdSchema, type RepositoryId } from "../../../src/shared/contracts/git-utility";
import type { RecoveryEntry } from "../../../src/shared/contracts/model";
import { GitUtilityError } from "./git-error";
import {
  MAX_RECOVERY_TEXT_CHARACTERS,
  RecoveryObjectIdSchema,
  hasSafeRecoveryRefStructure,
} from "./recovery-ref-transaction";
import {
  copyRepositorySnapshot,
  RepositorySnapshotSchema,
  type RepositorySnapshot,
} from "./recovery-snapshot";

export const MAX_RECOVERY_ENTRIES = 200;
export const MAX_RECOVERY_MANIFEST_BYTES = 96 * 1024 * 1024;

const MAX_RECOVERY_REFS = 32;
const LEGACY_MANIFEST_VERSION = 1;
const MANIFEST_VERSION = 2;
const ChecksumSchema = z.string().regex(/^[0-9a-f]{64}$/u);

const RecoveryRefSchema = z
  .object({
    name: z.string().max(MAX_RECOVERY_TEXT_CHARACTERS).refine(hasSafeRecoveryRefStructure),
    oid: RecoveryObjectIdSchema.nullable(),
  })
  .strict();
const RecoveryEntrySchema = z
  .object({
    id: z.uuid(),
    repositoryId: RepositoryIdSchema,
    operation: z
      .string()
      .min(1)
      .max(MAX_RECOVERY_TEXT_CHARACTERS)
      .refine((value) => !value.includes("\0")),
    createdAtMs: z.number().int().nonnegative().safe(),
    branch: z
      .string()
      .max(MAX_RECOVERY_TEXT_CHARACTERS)
      .refine((value) => !value.includes("\0"))
      .nullable(),
    headOid: RecoveryObjectIdSchema.nullable(),
    refs: z.array(RecoveryRefSchema).max(MAX_RECOVERY_REFS),
    recoverable: z.boolean(),
  })
  .strict()
  .superRefine((entry, context) => {
    const names = new Set<string>();
    for (const [index, reference] of entry.refs.entries()) {
      if (names.has(reference.name)) {
        context.addIssue({
          code: "custom",
          message: "Recovery entry contains duplicate refs",
          path: ["refs", index, "name"],
        });
      }
      names.add(reference.name);
    }
  });
const StoredRecoveryEntrySchema = RecoveryEntrySchema.safeExtend({
  snapshot: RepositorySnapshotSchema.nullable(),
});
const LegacyRecoveryManifestSchema = z
  .object({
    version: z.literal(LEGACY_MANIFEST_VERSION),
    entries: z.array(RecoveryEntrySchema).max(MAX_RECOVERY_ENTRIES),
    sha256: ChecksumSchema,
  })
  .strict();
const RecoveryManifestSchema = z
  .object({
    version: z.literal(MANIFEST_VERSION),
    entries: z.array(StoredRecoveryEntrySchema).max(MAX_RECOVERY_ENTRIES),
    sha256: ChecksumSchema,
  })
  .strict();

export interface StoredRecoveryEntry extends RecoveryEntry {
  readonly snapshot: RepositorySnapshot | null;
}

interface RecoveryManifestPayload {
  readonly version: typeof MANIFEST_VERSION;
  readonly entries: readonly StoredRecoveryEntry[];
}

interface LegacyRecoveryManifestPayload {
  readonly version: typeof LEGACY_MANIFEST_VERSION;
  readonly entries: readonly RecoveryEntry[];
}

function invalid(message: string): GitUtilityError {
  return new GitUtilityError("invalidInput", message);
}

function checksum(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function manifestPayload(entries: readonly StoredRecoveryEntry[]): RecoveryManifestPayload {
  return { version: MANIFEST_VERSION, entries };
}

function legacyManifestPayload(entries: readonly RecoveryEntry[]): LegacyRecoveryManifestPayload {
  return { version: LEGACY_MANIFEST_VERSION, entries };
}

function payloadBytes(payload: RecoveryManifestPayload | LegacyRecoveryManifestPayload): Buffer {
  return Buffer.from(JSON.stringify(payload), "utf8");
}

export function copyRecoveryEntry(entry: RecoveryEntry): RecoveryEntry {
  return {
    id: entry.id,
    repositoryId: entry.repositoryId,
    operation: entry.operation,
    createdAtMs: entry.createdAtMs,
    branch: entry.branch,
    headOid: entry.headOid,
    refs: entry.refs.map((reference) => ({ ...reference })),
    recoverable: entry.recoverable,
  };
}

export function copyStoredRecoveryEntry(entry: StoredRecoveryEntry): StoredRecoveryEntry {
  return {
    ...copyRecoveryEntry(entry),
    snapshot: entry.snapshot === null ? null : copyRepositorySnapshot(entry.snapshot),
  };
}

export function encodeRecoveryManifest(entries: readonly StoredRecoveryEntry[]): Buffer {
  const payload = manifestPayload(entries);
  return Buffer.from(
    `${JSON.stringify({ ...payload, sha256: checksum(payloadBytes(payload)) }, null, 2)}\n`,
    "utf8",
  );
}

export function decodeRecoveryManifest(
  bytes: Buffer,
  repositoryId: RepositoryId,
): readonly StoredRecoveryEntry[] {
  if (!isUtf8(bytes)) throw invalid("Recovery manifest must contain valid UTF-8");
  let decoded: unknown;
  try {
    decoded = JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw invalid("Recovery manifest is not valid JSON");
  }
  const parsed = RecoveryManifestSchema.safeParse(decoded);
  let entries: readonly StoredRecoveryEntry[];
  let expectedChecksum: string;
  let storedChecksum: string;
  if (parsed.success) {
    entries = parsed.data.entries.map(copyStoredRecoveryEntry);
    expectedChecksum = checksum(payloadBytes(manifestPayload(entries)));
    storedChecksum = parsed.data.sha256;
  } else {
    const legacy = LegacyRecoveryManifestSchema.safeParse(decoded);
    if (!legacy.success) throw invalid("Recovery manifest is invalid");
    const legacyEntries = legacy.data.entries.map(copyRecoveryEntry);
    entries = legacyEntries.map((entry) => ({ ...entry, snapshot: null }));
    expectedChecksum = checksum(payloadBytes(legacyManifestPayload(legacyEntries)));
    storedChecksum = legacy.data.sha256;
  }
  if (expectedChecksum !== storedChecksum) throw invalid("Recovery manifest checksum mismatch");
  for (const entry of entries) {
    if (entry.repositoryId !== repositoryId) {
      throw invalid("Recovery manifest contains an entry for another repository");
    }
  }
  return entries.map(copyStoredRecoveryEntry);
}
