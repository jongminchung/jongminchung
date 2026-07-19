import { isUtf8 } from "node:buffer";
import {
    createHmac,
    randomBytes,
    randomUUID,
    timingSafeEqual,
} from "node:crypto";
import { constants } from "node:fs";
import {
    chmod,
    lstat,
    mkdtemp,
    open,
    realpath,
    rename,
    rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
    basename,
    dirname,
    isAbsolute,
    join,
    relative,
    resolve,
    sep,
} from "node:path";
import { z } from "zod";
import type { RebasePlanEntry } from "../../../src/generated";
import {
    GitOperationSchema,
    type ValidatedGitOperation,
} from "../../../src/shared/contracts/git-operation";
import { safeErrorMessage } from "./redaction";

export const MAX_SEQUENCE_EDITOR_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_SEQUENCE_EDITOR_PAYLOAD_BYTES = 5 * 1024 * 1024;

const PAYLOAD_VERSION = 1;
const PAYLOAD_LIFETIME_MS = 2 * 60 * 60 * 1_000;
const NONCE_PATTERN = /^[0-9a-f]{64}$/u;
const MAC_PATTERN = /^[0-9a-f]{64}$/u;
const OID_PATTERN = /^[0-9a-f]{4,64}$/iu;
const ACTION_COMMANDS = new Set([
    "pick",
    "p",
    "reword",
    "edit",
    "squash",
    "fixup",
    "drop",
]);

type HistoryRewriteOperation = Extract<
    ValidatedGitOperation,
    Readonly<
        | { kind: "interactiveRebase" }
        | { kind: "dropCommits" }
        | { kind: "squashCommits" }
        | {
              kind: "rewordCommit";
          }
    >
>;

export type SequenceEditorMode = "sequence" | "message";
export type SequenceEditorErrorCode =
    | "invalidInput"
    | "authenticationFailed"
    | "expired"
    | "cancelled"
    | "io";

interface SequenceEditorPayload {
    readonly version: 1;
    readonly nonce: string;
    readonly createdAtMs: number;
    readonly expiresAtMs: number;
    readonly gitDirectory: string;
    readonly operation: HistoryRewriteOperation;
}

export interface ApplySequenceEditorRequest {
    readonly mode: SequenceEditorMode;
    readonly payloadPath: string;
    readonly nonce: string;
    readonly targetPath: string;
    readonly signal?: AbortSignal;
}

interface TodoLine {
    readonly line: string;
    readonly command: string;
    readonly oid: string | null;
}

interface CheckedTarget {
    readonly path: string;
    readonly device: number;
    readonly inode: number;
    readonly mode: number;
}

const PayloadSchema = z
    .object({
        version: z.literal(PAYLOAD_VERSION),
        nonce: z.string().regex(NONCE_PATTERN),
        createdAtMs: z.number().int().nonnegative().safe(),
        expiresAtMs: z.number().int().positive().safe(),
        gitDirectory: z.string().min(1).max(16_384),
        operation: GitOperationSchema,
    })
    .strict();
const EnvelopeSchema = z
    .object({
        payload: z.string().min(1).max(MAX_SEQUENCE_EDITOR_PAYLOAD_BYTES),
        mac: z.string().regex(MAC_PATTERN),
    })
    .strict();

export class SequenceEditorError extends Error {
    readonly code: SequenceEditorErrorCode;

    constructor(code: SequenceEditorErrorCode, message: string) {
        super(safeErrorMessage(message));
        this.name = "SequenceEditorError";
        this.code = code;
    }
}

function invalid(message: string): SequenceEditorError {
    return new SequenceEditorError("invalidInput", message);
}

function assertNotAborted(signal?: AbortSignal): void {
    if (signal?.aborted === true)
        throw new SequenceEditorError("cancelled", "Sequence edit cancelled");
}

function encodedBytes(value: string): number {
    return Buffer.byteLength(value, "utf8");
}

function macFor(payload: string, nonce: string): string {
    return createHmac("sha256", Buffer.from(nonce, "hex"))
        .update(payload, "utf8")
        .digest("hex");
}

function safelyEqualHex(left: string, right: string): boolean {
    if (!NONCE_PATTERN.test(left) || !NONCE_PATTERN.test(right)) return false;
    return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function safeAbsolutePath(path: string, field: string): void {
    if (
        path.length === 0 ||
        path.length > 16_384 ||
        path.includes("\0") ||
        !isAbsolute(path) ||
        resolve(path) !== path
    ) {
        throw invalid(`${field} must be a normalized absolute path`);
    }
}

function isInside(root: string, path: string): boolean {
    const child = relative(root, path);
    return (
        child === "" ||
        !(child === ".." || child.startsWith(`..${sep}`) || isAbsolute(child))
    );
}

function parseOperation(operation: unknown): HistoryRewriteOperation {
    const result = GitOperationSchema.safeParse(operation);
    if (!result.success) {
        throw invalid(
            result.error.issues[0]?.message ??
                "Invalid interactive rebase plan",
        );
    }
    if (
        result.data.kind !== "interactiveRebase" &&
        result.data.kind !== "dropCommits" &&
        result.data.kind !== "squashCommits" &&
        result.data.kind !== "rewordCommit"
    ) {
        throw invalid(
            "Sequence editor payload must contain a history rewrite operation",
        );
    }
    if (result.data.kind !== "interactiveRebase") return result.data;
    const rewordSubjects = new Set<string>();
    for (const entry of result.data.entries) {
        if (entry.action !== "reword") continue;
        if (rewordSubjects.has(entry.subject)) {
            throw invalid("Reword entries must have unique subjects");
        }
        rewordSubjects.add(entry.subject);
    }
    return result.data;
}

async function canonicalGitDirectory(path: string): Promise<string> {
    safeAbsolutePath(path, "Git directory");
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
        throw invalid("Git directory must be a real directory");
    }
    return realpath(path);
}

async function readBoundedUtf8(
    path: string,
    maximum: number,
    field: string,
    expectedTarget?: CheckedTarget,
): Promise<string> {
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const metadata = await handle.stat();
        if (!metadata.isFile())
            throw invalid(`${field} must be a regular file`);
        if (
            expectedTarget !== undefined &&
            (metadata.dev !== expectedTarget.device ||
                metadata.ino !== expectedTarget.inode)
        ) {
            throw invalid(`${field} changed before it could be read`);
        }
        if (metadata.size > maximum) throw invalid(`${field} exceeds 5 MiB`);
        const bytes = await handle.readFile();
        if (bytes.byteLength > maximum) throw invalid(`${field} exceeds 5 MiB`);
        if (!isUtf8(bytes) || bytes.includes(0)) {
            throw invalid(`${field} must be UTF-8 text without null bytes`);
        }
        return bytes.toString("utf8");
    } finally {
        await handle.close();
    }
}

async function readPayload(
    payloadPath: string,
    nonce: string,
): Promise<SequenceEditorPayload> {
    safeAbsolutePath(payloadPath, "Payload path");
    if (!NONCE_PATTERN.test(nonce)) {
        throw new SequenceEditorError(
            "authenticationFailed",
            "Sequence editor authentication failed",
        );
    }
    const parent = dirname(payloadPath);
    const [
        payloadMetadata,
        parentMetadata,
        canonicalParent,
        canonicalPayload,
        canonicalTemporaryRoot,
    ] = await Promise.all([
        lstat(payloadPath),
        lstat(parent),
        realpath(parent),
        realpath(payloadPath),
        realpath(tmpdir()),
    ]);
    if (
        payloadMetadata.isSymbolicLink() ||
        !payloadMetadata.isFile() ||
        parentMetadata.isSymbolicLink() ||
        !parentMetadata.isDirectory() ||
        basename(payloadPath) !== "payload.json" ||
        !basename(parent).startsWith("git-client-sequence-") ||
        dirname(canonicalParent) !== canonicalTemporaryRoot ||
        canonicalPayload !== join(canonicalParent, "payload.json") ||
        (payloadMetadata.mode & 0o777) !== 0o600 ||
        (parentMetadata.mode & 0o777) !== 0o700
    ) {
        throw new SequenceEditorError(
            "authenticationFailed",
            "Sequence editor payload is not trusted",
        );
    }
    const envelopeText = await readBoundedUtf8(
        payloadPath,
        MAX_SEQUENCE_EDITOR_PAYLOAD_BYTES,
        "Sequence editor payload",
    );
    let envelopeValue: unknown;
    try {
        envelopeValue = JSON.parse(envelopeText);
    } catch {
        throw new SequenceEditorError(
            "authenticationFailed",
            "Sequence editor payload is malformed",
        );
    }
    const envelope = EnvelopeSchema.safeParse(envelopeValue);
    if (!envelope.success) {
        throw new SequenceEditorError(
            "authenticationFailed",
            "Sequence editor payload is malformed",
        );
    }
    const expectedMac = macFor(envelope.data.payload, nonce);
    if (!safelyEqualHex(envelope.data.mac, expectedMac)) {
        throw new SequenceEditorError(
            "authenticationFailed",
            "Sequence editor authentication failed",
        );
    }
    let payloadValue: unknown;
    try {
        payloadValue = JSON.parse(envelope.data.payload);
    } catch {
        throw new SequenceEditorError(
            "authenticationFailed",
            "Sequence editor payload is malformed",
        );
    }
    const parsed = PayloadSchema.safeParse(payloadValue);
    if (!parsed.success || !safelyEqualHex(parsed.data.nonce, nonce)) {
        throw new SequenceEditorError(
            "authenticationFailed",
            "Sequence editor authentication failed",
        );
    }
    if (parsed.data.expiresAtMs < Date.now()) {
        throw new SequenceEditorError(
            "expired",
            "Sequence editor payload expired",
        );
    }
    if (
        parsed.data.expiresAtMs <= parsed.data.createdAtMs ||
        parsed.data.expiresAtMs - parsed.data.createdAtMs > PAYLOAD_LIFETIME_MS
    ) {
        throw new SequenceEditorError(
            "authenticationFailed",
            "Sequence editor payload lifetime is invalid",
        );
    }
    const operation = parseOperation(parsed.data.operation);
    return {
        version: PAYLOAD_VERSION,
        nonce: parsed.data.nonce,
        createdAtMs: parsed.data.createdAtMs,
        expiresAtMs: parsed.data.expiresAtMs,
        gitDirectory: parsed.data.gitDirectory,
        operation,
    };
}

async function checkedTarget(
    payload: SequenceEditorPayload,
    targetPath: string,
): Promise<CheckedTarget> {
    safeAbsolutePath(targetPath, "Editor target");
    const metadata = await lstat(targetPath);
    if (metadata.isSymbolicLink() || !metadata.isFile()) {
        throw invalid(
            "Editor target must be a regular file, not a symbolic link",
        );
    }
    if (metadata.size > MAX_SEQUENCE_EDITOR_FILE_BYTES) {
        throw invalid("Editor target exceeds 5 MiB");
    }
    const [gitDirectory, parent] = await Promise.all([
        canonicalGitDirectory(payload.gitDirectory),
        realpath(dirname(targetPath)),
    ]);
    if (!isInside(gitDirectory, parent)) {
        throw invalid(
            "Editor target must stay inside the registered Git directory",
        );
    }
    return {
        path: targetPath,
        device: metadata.dev,
        inode: metadata.ino,
        mode: metadata.mode,
    };
}

function todoOid(command: string, fields: readonly string[]): string | null {
    if (ACTION_COMMANDS.has(command)) return fields[1] ?? null;
    if (command !== "merge") return null;
    for (let index = 1; index + 1 < fields.length; index += 1) {
        if (fields[index] === "-C" || fields[index] === "-c")
            return fields[index + 1] ?? null;
    }
    return null;
}

function parseTodo(todo: string): readonly TodoLine[] {
    return todo
        .split(/\r?\n/u)
        .slice(0, todo.endsWith("\n") ? -1 : undefined)
        .map((line) => {
            const fields = line.trim().split(/\s+/u);
            const command = fields[0] ?? "";
            const oid = todoOid(command, fields);
            if (oid !== null && !OID_PATTERN.test(oid)) {
                throw invalid("Rebase todo contains an invalid object ID");
            }
            return { line, command, oid };
        });
}

function entryForOid(
    entries: readonly RebasePlanEntry[],
    oid: string,
): RebasePlanEntry {
    const normalizedOid = oid.toLowerCase();
    const matches = entries.filter(
        (entry) =>
            entry.oid.toLowerCase().startsWith(normalizedOid) ||
            normalizedOid.startsWith(entry.oid.toLowerCase()),
    );
    if (matches.length === 0)
        throw invalid(`Commit ${oid} is missing from the rebase plan`);
    if (matches.length > 1)
        throw invalid(`Commit ${oid} is ambiguous in the rebase plan`);
    const entry = matches[0];
    if (entry === undefined)
        throw invalid(`Commit ${oid} is missing from the rebase plan`);
    return entry;
}

function commandForAction(action: RebasePlanEntry["action"]): string {
    return action;
}

function rewritePlanLine(line: TodoLine, entry: RebasePlanEntry): string {
    if (line.command === "merge") {
        if (!entry.mergeCommit || entry.action !== "pick") {
            throw invalid(
                "Merge commits must remain pick entries when preserving merges",
            );
        }
        return line.line;
    }
    if (entry.mergeCommit) {
        throw invalid(
            "A merge commit is missing its merge-preserving todo command",
        );
    }
    return line.line.replace(line.command, commandForAction(entry.action));
}

function assertEveryEntryMatched(
    entries: readonly RebasePlanEntry[],
    matched: ReadonlySet<string>,
): void {
    if (entries.some((entry) => !matched.has(entry.oid.toLowerCase()))) {
        throw invalid("Not every planned commit is present in the rebase todo");
    }
}

function oidMatches(revision: string, todoOidValue: string): boolean {
    const normalizedRevision = revision.toLowerCase();
    const normalizedTodoOid = todoOidValue.toLowerCase();
    return (
        normalizedRevision.startsWith(normalizedTodoOid) ||
        normalizedTodoOid.startsWith(normalizedRevision)
    );
}

function replaceTodoCommand(line: TodoLine, command: string): string {
    if (line.command === "merge") {
        throw invalid(
            "Merge commits cannot be rewritten by this history operation",
        );
    }
    return line.line.replace(line.command, command);
}

function rewriteTargetedTodo(
    todo: string,
    operation: Exclude<
        HistoryRewriteOperation,
        Readonly<{ kind: "interactiveRebase" }>
    >,
): string {
    const parsed = parseTodo(todo);
    const revisions =
        operation.kind === "rewordCommit"
            ? [operation.revision]
            : operation.revisions;
    const matched = new Set<string>();
    const targeted = parsed.flatMap((line, index) => {
        if (line.oid === null) return [];
        const matches = revisions.filter((revision) =>
            oidMatches(revision, line.oid ?? ""),
        );
        if (matches.length > 1)
            throw invalid(`Commit ${line.oid} is ambiguous in the rebase todo`);
        const revision = matches[0];
        if (revision === undefined) return [];
        matched.add(revision.toLowerCase());
        return [{ index, line, revision }];
    });
    if (revisions.some((revision) => !matched.has(revision.toLowerCase()))) {
        throw invalid(
            "Not every selected commit is present in the rebase todo",
        );
    }
    if (operation.kind === "squashCommits") {
        if (targeted.length < 2)
            throw invalid("Squash requires at least two commits");
        for (let index = 1; index < targeted.length; index += 1) {
            const previous = targeted[index - 1];
            const current = targeted[index];
            if (
                previous === undefined ||
                current === undefined ||
                current.index !== previous.index + 1
            ) {
                throw invalid(
                    "Squashed commits must be consecutive in the rebase todo",
                );
            }
        }
    }
    const targetIndexes = new Map(
        targeted.map((target, index) => [target.index, index]),
    );
    const output = parsed.map((line, index) => {
        const targetIndex = targetIndexes.get(index);
        if (targetIndex === undefined) return line.line;
        if (operation.kind === "dropCommits")
            return replaceTodoCommand(line, "drop");
        if (operation.kind === "rewordCommit")
            return replaceTodoCommand(line, "reword");
        return targetIndex === 0
            ? line.line
            : replaceTodoCommand(line, "squash");
    });
    return `${output.join("\n")}\n`;
}

function rewriteTodo(todo: string, operation: HistoryRewriteOperation): string {
    if (operation.kind !== "interactiveRebase")
        return rewriteTargetedTodo(todo, operation);
    const parsed = parseTodo(todo);
    const preserveMerges =
        operation.options.preserveMerges ||
        parsed.some((line) => line.command === "merge");
    const matched = new Set<string>();
    if (preserveMerges) {
        const output = parsed.map((line) => {
            if (line.oid === null) return line.line;
            const entry = entryForOid(operation.entries, line.oid);
            const normalizedOid = entry.oid.toLowerCase();
            if (matched.has(normalizedOid))
                throw invalid("Rebase todo contains a duplicate commit");
            matched.add(normalizedOid);
            return rewritePlanLine(line, entry);
        });
        assertEveryEntryMatched(operation.entries, matched);
        return `${output.join("\n")}\n`;
    }

    const commitLines = parsed.filter((line) => line.oid !== null);
    for (const line of commitLines) {
        const oid = line.oid;
        if (oid === null) continue;
        const entry = entryForOid(operation.entries, oid);
        const normalizedOid = entry.oid.toLowerCase();
        if (matched.has(normalizedOid))
            throw invalid("Rebase todo contains a duplicate commit");
        matched.add(normalizedOid);
    }
    assertEveryEntryMatched(operation.entries, matched);
    const output = operation.entries.map((entry) => {
        const matches = commitLines.filter((line) => {
            if (line.oid === null) return false;
            const entryOid = entry.oid.toLowerCase();
            const lineOid = line.oid.toLowerCase();
            return entryOid.startsWith(lineOid) || lineOid.startsWith(entryOid);
        });
        if (matches.length !== 1)
            throw invalid(
                `Commit ${entry.oid} is missing or ambiguous in the todo`,
            );
        const line = matches[0];
        if (line === undefined)
            throw invalid(`Commit ${entry.oid} is missing from the todo`);
        return rewritePlanLine(line, entry);
    });
    output.push(
        ...parsed.filter((line) => line.oid === null).map((line) => line.line),
    );
    return `${output.join("\n")}\n`;
}

function rewriteMessage(
    existing: string,
    operation: HistoryRewriteOperation,
): string {
    if (operation.kind === "rewordCommit")
        return `${operation.message.trim()}\n`;
    if (operation.kind !== "interactiveRebase") return existing;
    const subject =
        existing
            .split(/\r?\n/u)
            .find((line) => !line.startsWith("#"))
            ?.trim() ?? "";
    const matching = operation.entries.filter(
        (entry) => entry.action === "reword" && entry.subject === subject,
    );
    if (matching.length > 1)
        throw invalid("Commit message matches multiple reword entries");
    const squashMessage = operation.entries.some(
        (entry) => entry.action === "squash",
    )
        ? (operation.entries.find((entry) => entry.action === "reword")
              ?.message ?? null)
        : null;
    const replacement = existing.includes("# This is a combination of")
        ? (squashMessage ?? matching[0]?.message ?? existing)
        : (matching[0]?.message ?? existing);
    const trimmed = replacement.trim();
    if (
        trimmed.length === 0 ||
        trimmed.includes("\0") ||
        encodedBytes(trimmed) > MAX_SEQUENCE_EDITOR_FILE_BYTES
    ) {
        throw invalid("Replacement commit message is invalid");
    }
    return `${trimmed}\n`;
}

async function atomicWrite(
    target: CheckedTarget,
    content: string,
    signal?: AbortSignal,
): Promise<void> {
    if (encodedBytes(content) > MAX_SEQUENCE_EDITOR_FILE_BYTES) {
        throw invalid("Editor replacement exceeds 5 MiB");
    }
    const temporary = join(
        dirname(target.path),
        `.git-client-sequence-${randomUUID()}.tmp`,
    );
    try {
        assertNotAborted(signal);
        const handle = await open(temporary, "wx", 0o600);
        try {
            await handle.writeFile(content, "utf8");
            await handle.sync();
        } finally {
            await handle.close();
        }
        await chmod(temporary, target.mode & 0o777);
        assertNotAborted(signal);
        const latestTarget = await lstat(target.path);
        if (
            latestTarget.isSymbolicLink() ||
            !latestTarget.isFile() ||
            latestTarget.dev !== target.device ||
            latestTarget.ino !== target.inode
        ) {
            throw invalid("Editor target changed before replacement");
        }
        await rename(temporary, target.path);
    } catch (error) {
        await rm(temporary, { force: true });
        throw error;
    }
}

export class SequenceEditorSession {
    readonly directory: string;
    readonly payloadPath: string;
    readonly nonce: string;
    readonly #signal: AbortSignal | null;
    readonly #abortListener: (() => void) | null;
    #cleanupPromise: Promise<void> | null = null;

    private constructor(
        directory: string,
        payloadPath: string,
        nonce: string,
        signal?: AbortSignal,
    ) {
        this.directory = directory;
        this.payloadPath = payloadPath;
        this.nonce = nonce;
        this.#signal = signal ?? null;
        this.#abortListener =
            signal === undefined ? null : () => void this.cleanup();
        if (signal !== undefined && this.#abortListener !== null) {
            signal.addEventListener("abort", this.#abortListener, {
                once: true,
            });
        }
    }

    static async create(
        gitDirectory: string,
        untrustedOperation: unknown,
        signal?: AbortSignal,
    ): Promise<SequenceEditorSession> {
        assertNotAborted(signal);
        const operation = parseOperation(untrustedOperation);
        const canonicalDirectory = await canonicalGitDirectory(gitDirectory);
        const nonce = randomBytes(32).toString("hex");
        const createdAtMs = Date.now();
        const payload: SequenceEditorPayload = {
            version: PAYLOAD_VERSION,
            nonce,
            createdAtMs,
            expiresAtMs: createdAtMs + PAYLOAD_LIFETIME_MS,
            gitDirectory: canonicalDirectory,
            operation,
        };
        const payloadText = JSON.stringify(payload);
        const envelopeText = JSON.stringify({
            payload: payloadText,
            mac: macFor(payloadText, nonce),
        });
        if (encodedBytes(envelopeText) > MAX_SEQUENCE_EDITOR_PAYLOAD_BYTES) {
            throw invalid("Interactive rebase payload exceeds 5 MiB");
        }

        let directory: string | null = null;
        try {
            directory = await mkdtemp(join(tmpdir(), "git-client-sequence-"));
            await chmod(directory, 0o700);
            const payloadPath = join(directory, "payload.json");
            const handle = await open(payloadPath, "wx", 0o600);
            try {
                await handle.writeFile(envelopeText, "utf8");
                await handle.sync();
            } finally {
                await handle.close();
            }
            await chmod(payloadPath, 0o600);
            const session = new SequenceEditorSession(
                directory,
                payloadPath,
                nonce,
                signal,
            );
            if (signal?.aborted === true) {
                await session.cleanup();
                assertNotAborted(signal);
            }
            return session;
        } catch (error) {
            if (directory !== null)
                await rm(directory, { recursive: true, force: true });
            if (error instanceof SequenceEditorError) throw error;
            throw new SequenceEditorError(
                "io",
                error instanceof Error
                    ? error.message
                    : "Could not create sequence editor payload",
            );
        }
    }

    cleanup(): Promise<void> {
        if (this.#cleanupPromise !== null) return this.#cleanupPromise;
        if (this.#signal !== null && this.#abortListener !== null) {
            this.#signal.removeEventListener("abort", this.#abortListener);
        }
        this.#cleanupPromise = rm(this.directory, {
            recursive: true,
            force: true,
        });
        return this.#cleanupPromise;
    }
}

export async function applySequenceEditor(
    request: ApplySequenceEditorRequest,
): Promise<void> {
    assertNotAborted(request.signal);
    const payload = await readPayload(request.payloadPath, request.nonce);
    const target = await checkedTarget(payload, request.targetPath);
    const existing = await readBoundedUtf8(
        target.path,
        MAX_SEQUENCE_EDITOR_FILE_BYTES,
        "Editor target",
        target,
    );
    assertNotAborted(request.signal);
    const replacement =
        request.mode === "sequence"
            ? rewriteTodo(existing, payload.operation)
            : rewriteMessage(existing, payload.operation);
    await atomicWrite(target, replacement, request.signal);
}
