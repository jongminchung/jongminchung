import { Buffer, isUtf8 } from "node:buffer";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { open, readFile, realpath, rename, stat, unlink } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, sep } from "node:path";
import type { Readable } from "node:stream";
import type { ChildProcessByStdio } from "node:child_process";
import type {
    FileContent,
    FilePreview,
    FileSource,
    RepositoryId,
} from "../../../src/shared/contracts/git-utility";
import type { SubmoduleDiff } from "../../../src/generated";
import { GitUtilityError } from "./git-error";
import { GitProcessRunner, type GitProcessRunnerLike } from "./git-process";
import type { RepositoryRegistry } from "./repository-registry";
import { validateRelativePath, validateRevision } from "./validation";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_LINES = 50_000;

type SourceReadResult =
    | Readonly<{ kind: "bytes"; bytes: Buffer }>
    | Readonly<{ kind: "tooLarge"; sizeBytes: number }>
    | Readonly<{ kind: "missing" }>;

interface BinaryGitReader {
    capture(
        cwd: string,
        args: readonly string[],
        maximumBytes: number,
    ): Promise<Buffer | null>;
}

const GIT_ENVIRONMENT = Object.freeze({
    GIT_TERMINAL_PROMPT: "0",
    GIT_PAGER: "cat",
    GIT_OPTIONAL_LOCKS: "0",
    LC_ALL: "C",
});

class SpawnBinaryGitReader implements BinaryGitReader {
    capture(
        cwd: string,
        args: readonly string[],
        maximumBytes: number,
    ): Promise<Buffer | null> {
        return new Promise((resolve, reject) => {
            let child: ChildProcessByStdio<null, Readable, Readable>;
            try {
                child = spawn("git", [...args], {
                    cwd,
                    env: { ...process.env, ...GIT_ENVIRONMENT },
                    shell: false,
                    stdio: ["ignore", "pipe", "pipe"],
                    windowsHide: true,
                });
            } catch (error) {
                reject(
                    new GitUtilityError(
                        "gitUnavailable",
                        error instanceof Error
                            ? error.message
                            : "Unable to start Git",
                    ),
                );
                return;
            }

            const chunks: Buffer[] = [];
            let sizeBytes = 0;
            let settled = false;
            let timeout: NodeJS.Timeout | null = null;
            const finish = (settle: () => void): void => {
                if (settled) return;
                settled = true;
                if (timeout !== null) clearTimeout(timeout);
                settle();
            };
            timeout = setTimeout(() => {
                child.kill("SIGKILL");
                finish(() =>
                    reject(
                        new GitUtilityError(
                            "commandFailed",
                            "Git file read timed out",
                        ),
                    ),
                );
            }, 120_000);
            timeout.unref();
            child.stdout.on("data", (value: Buffer) => {
                if (settled) return;
                sizeBytes += value.byteLength;
                if (sizeBytes > maximumBytes) {
                    child.kill("SIGKILL");
                    finish(() =>
                        reject(
                            new GitUtilityError(
                                "outputLimit",
                                `Git output exceeded ${maximumBytes} bytes`,
                            ),
                        ),
                    );
                    return;
                }
                chunks.push(Buffer.from(value));
            });
            child.stderr.resume();
            child.once("error", (error) => {
                finish(() =>
                    reject(
                        new GitUtilityError("gitUnavailable", error.message),
                    ),
                );
            });
            child.once("close", (exitCode) => {
                finish(() =>
                    resolve(exitCode === 0 ? Buffer.concat(chunks) : null),
                );
            });
        });
    }
}

function lineCount(content: string): number {
    if (content.length === 0) return 0;
    const newlines = content.match(/\n/gu)?.length ?? 0;
    return newlines + (content.endsWith("\n") ? 0 : 1);
}

export function classifyFileContent(
    path: string,
    bytes: Uint8Array,
): FileContent {
    const buffer = Buffer.from(bytes);
    const sizeBytes = buffer.byteLength;
    if (sizeBytes > MAX_FILE_BYTES) {
        return { kind: "tooLarge", path, sizeBytes, lineCount: null };
    }
    if (buffer.includes(0)) return { kind: "binary", path, sizeBytes };
    if (!isUtf8(buffer)) return { kind: "invalidUtf8", path, sizeBytes };
    const text = buffer.toString("utf8");
    const lines = lineCount(text);
    if (lines > MAX_FILE_LINES) {
        return { kind: "tooLarge", path, sizeBytes, lineCount: lines };
    }
    return { kind: "text", path, content: text, sizeBytes, lineCount: lines };
}

export function classifyFilePreview(
    path: string,
    bytes: Uint8Array,
): FilePreview {
    const buffer = Buffer.from(bytes);
    const sizeBytes = buffer.byteLength;
    if (sizeBytes > MAX_FILE_BYTES)
        return { kind: "tooLarge", path, sizeBytes };
    let mimeType: "image/png" | "image/jpeg" | "image/webp" | null = null;
    if (
        buffer
            .subarray(0, 8)
            .equals(
                Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
            )
    ) {
        mimeType = "image/png";
    } else if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) {
        mimeType = "image/jpeg";
    } else if (
        buffer.byteLength >= 12 &&
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WEBP"
    ) {
        mimeType = "image/webp";
    }
    if (mimeType === null) return { kind: "binary", path, sizeBytes };
    return {
        kind: "image",
        preview: {
            path,
            mimeType,
            dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
            sizeBytes,
        },
    };
}

function isMissingFileError(error: unknown): boolean {
    if (typeof error !== "object" || error === null || !("code" in error))
        return false;
    return error.code === "ENOENT" || error.code === "ENOTDIR";
}

export class GitFileService {
    readonly #registry: RepositoryRegistry;
    readonly #git: BinaryGitReader;
    readonly #runner: GitProcessRunnerLike;

    private constructor(
        registry: RepositoryRegistry,
        git: BinaryGitReader,
        runner: GitProcessRunnerLike,
    ) {
        this.#registry = registry;
        this.#git = git;
        this.#runner = runner;
    }

    static of(registry: RepositoryRegistry): GitFileService {
        return new GitFileService(
            registry,
            new SpawnBinaryGitReader(),
            new GitProcessRunner(),
        );
    }

    async readFile(
        repositoryId: RepositoryId,
        source: FileSource,
        path: string,
    ): Promise<FileContent> {
        const result = await this.#readSource(repositoryId, source, path);
        if (result.kind === "missing") return { kind: "missing", path };
        if (result.kind === "tooLarge") {
            return {
                kind: "tooLarge",
                path,
                sizeBytes: result.sizeBytes,
                lineCount: null,
            };
        }
        return classifyFileContent(path, result.bytes);
    }

    async readFilePreview(
        repositoryId: RepositoryId,
        source: FileSource,
        path: string,
    ): Promise<FilePreview> {
        const result = await this.#readSource(repositoryId, source, path);
        if (result.kind === "missing") return { kind: "missing", path };
        if (result.kind === "tooLarge") {
            return { kind: "tooLarge", path, sizeBytes: result.sizeBytes };
        }
        return classifyFilePreview(path, result.bytes);
    }

    async writeWorkingTreeFile(
        repositoryId: RepositoryId,
        path: string,
        content: string,
    ): Promise<void> {
        validateRelativePath(path);
        const repository = this.#registry.get(repositoryId);
        if (repository.isBare) {
            throw new GitUtilityError(
                "invalidInput",
                "Bare repositories do not have worktree files",
            );
        }
        const bytes = Buffer.from(content, "utf8");
        if (bytes.byteLength > MAX_FILE_BYTES) {
            throw new GitUtilityError(
                "outputLimit",
                `File content exceeds ${MAX_FILE_BYTES} bytes`,
            );
        }
        const requested = join(repository.path, path);
        let canonical: string;
        let mode = 0o644;
        try {
            canonical = await realpath(requested);
            const metadata = await stat(canonical);
            if (!metadata.isFile()) {
                throw new GitUtilityError(
                    "invalidInput",
                    "Only regular worktree files can be edited",
                );
            }
            mode = metadata.mode & 0o777;
        } catch (error) {
            if (!isMissingFileError(error)) throw error;
            let canonicalParent: string;
            try {
                canonicalParent = await realpath(dirname(requested));
            } catch (parentError) {
                if (isMissingFileError(parentError)) {
                    throw new GitUtilityError(
                        "invalidInput",
                        "The parent directory does not exist",
                    );
                }
                throw parentError;
            }
            canonical = join(canonicalParent, basename(requested));
        }
        const relativePath = relative(repository.path, canonical);
        if (
            relativePath === ".." ||
            relativePath.startsWith(`..${sep}`) ||
            isAbsolute(relativePath)
        ) {
            throw new GitUtilityError(
                "invalidInput",
                "Path resolves outside the repository",
            );
        }
        const temporary = join(
            dirname(canonical),
            `.git-client-edit-${randomUUID()}.tmp`,
        );
        const handle = await open(temporary, "wx", mode);
        let closed = false;
        try {
            await handle.writeFile(bytes);
            await handle.sync();
            await handle.close();
            closed = true;
            await rename(temporary, canonical);
        } catch (error) {
            if (!closed) await handle.close().catch(() => undefined);
            await unlink(temporary).catch(() => undefined);
            throw error;
        }
    }

    async loadSubmoduleDiff(
        repositoryId: RepositoryId,
        before: FileSource,
        after: FileSource,
        path: string,
    ): Promise<SubmoduleDiff> {
        validateRelativePath(path);
        const repository = this.#registry.get(repositoryId);
        const beforeOid = await this.#submoduleOid(
            repository.path,
            before,
            path,
        );
        const afterOid = await this.#submoduleOid(repository.path, after, path);
        const directory = await this.#submoduleDirectory(repository.path, path);
        const beforeSubject =
            directory === null || beforeOid === null
                ? null
                : await this.#captureOptional(directory, [
                      "show",
                      "-s",
                      "--format=%s",
                      beforeOid,
                  ]);
        const afterSubject =
            directory === null || afterOid === null
                ? null
                : await this.#captureOptional(directory, [
                      "show",
                      "-s",
                      "--format=%s",
                      afterOid,
                  ]);
        const counts =
            directory === null || beforeOid === null || afterOid === null
                ? null
                : await this.#captureOptional(directory, [
                      "rev-list",
                      "--left-right",
                      "--count",
                      `${beforeOid}...${afterOid}`,
                  ]);
        const countValues = counts
            ?.trim()
            .split(/\s+/u)
            .map((value) => Number(value)) ?? [Number.NaN, Number.NaN];
        const behind = Number(countValues[0] ?? Number.NaN);
        const ahead = Number(countValues[1] ?? Number.NaN);
        const validCounts =
            Number.isSafeInteger(ahead) &&
            ahead >= 0 &&
            Number.isSafeInteger(behind) &&
            behind >= 0;
        return {
            path,
            beforeOid,
            afterOid,
            beforeSubject: beforeSubject?.trim() || null,
            afterSubject: afterSubject?.trim() || null,
            ahead: validCounts ? ahead : null,
            behind: validCounts ? behind : null,
        };
    }

    async #readSource(
        repositoryId: RepositoryId,
        source: FileSource,
        path: string,
    ): Promise<SourceReadResult> {
        validateRelativePath(path);
        const repository = this.#registry.get(repositoryId);
        if (source.kind === "workingTree") {
            if (repository.isBare) {
                throw new GitUtilityError(
                    "invalidInput",
                    "Bare repositories do not have worktree files",
                );
            }
            return this.#readWorkingTree(repository.path, path);
        }
        const object =
            source.kind === "index"
                ? `:${path}`
                : this.#revisionObject(source.revision, path);
        return this.#readObject(repository.path, object, path);
    }

    #revisionObject(revision: string, path: string): string {
        validateRevision(revision);
        return `${revision}:${path}`;
    }

    async #readWorkingTree(
        root: string,
        path: string,
    ): Promise<SourceReadResult> {
        let canonical: string;
        try {
            canonical = await realpath(join(root, path));
        } catch (error) {
            if (isMissingFileError(error)) return { kind: "missing" };
            throw error;
        }
        const relativePath = relative(root, canonical);
        if (
            relativePath === ".." ||
            relativePath.startsWith(`..${sep}`) ||
            isAbsolute(relativePath)
        ) {
            throw new GitUtilityError(
                "invalidInput",
                "Path resolves outside the repository",
            );
        }
        const metadata = await stat(canonical);
        if (!metadata.isFile()) return { kind: "missing" };
        if (metadata.size > MAX_FILE_BYTES)
            return { kind: "tooLarge", sizeBytes: metadata.size };
        return { kind: "bytes", bytes: await readFile(canonical) };
    }

    async #readObject(
        root: string,
        object: string,
        path: string,
    ): Promise<SourceReadResult> {
        const rawSize = await this.#git.capture(
            root,
            ["cat-file", "-s", object],
            1_024,
        );
        if (rawSize === null) return { kind: "missing" };
        const text = rawSize.toString("ascii").trim();
        if (!/^\d+$/u.test(text)) {
            throw new GitUtilityError(
                "commandFailed",
                `Git returned an invalid size for ${path}`,
            );
        }
        const sizeBytes = Number(text);
        if (!Number.isSafeInteger(sizeBytes)) {
            throw new GitUtilityError(
                "commandFailed",
                `Git returned an invalid size for ${path}`,
            );
        }
        if (sizeBytes > MAX_FILE_BYTES) return { kind: "tooLarge", sizeBytes };
        const bytes = await this.#git.capture(
            root,
            ["cat-file", "blob", object],
            MAX_FILE_BYTES,
        );
        return bytes === null ? { kind: "missing" } : { kind: "bytes", bytes };
    }

    async #submoduleOid(
        root: string,
        source: FileSource,
        path: string,
    ): Promise<string | null> {
        let output: string | null;
        if (source.kind === "workingTree") {
            const directory = await this.#submoduleDirectory(root, path);
            output =
                directory === null
                    ? null
                    : await this.#captureOptional(directory, [
                          "rev-parse",
                          "--verify",
                          "HEAD",
                      ]);
        } else if (source.kind === "index") {
            output = await this.#captureOptional(root, [
                "ls-files",
                "--stage",
                "--",
                path,
            ]);
        } else {
            validateRevision(source.revision);
            output = await this.#captureOptional(root, [
                "ls-tree",
                source.revision,
                "--",
                path,
            ]);
        }
        if (output === null) return null;
        if (source.kind === "workingTree") return this.#parseOid(output);
        const fields = output.trim().split(/\s+/u);
        if (fields[0] !== "160000") return null;
        return (
            fields
                .map((field) => this.#parseOid(field))
                .find((oid) => oid !== null) ?? null
        );
    }

    #parseOid(value: string): string | null {
        const oid = value.trim();
        return /^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/u.test(oid) ? oid : null;
    }

    async #submoduleDirectory(
        root: string,
        path: string,
    ): Promise<string | null> {
        let canonicalRoot: string;
        let canonical: string;
        try {
            canonicalRoot = await realpath(root);
            canonical = await realpath(join(root, path));
        } catch (error) {
            if (isMissingFileError(error)) return null;
            throw error;
        }
        const relativePath = relative(canonicalRoot, canonical);
        if (
            relativePath === ".." ||
            relativePath.startsWith(`..${sep}`) ||
            isAbsolute(relativePath)
        ) {
            throw new GitUtilityError(
                "invalidInput",
                "Submodule path resolves outside the repository",
            );
        }
        return (await stat(canonical)).isDirectory() ? canonical : null;
    }

    async #captureOptional(
        cwd: string,
        args: readonly string[],
    ): Promise<string | null> {
        const outcome = await this.#runner.run({ cwd, args });
        if (outcome.kind === "completed") {
            return outcome.output
                .filter((entry) => entry.stream === "stdout")
                .map((entry) => entry.data)
                .join("");
        }
        if (outcome.kind === "failed" && outcome.code === "commandFailed")
            return null;
        if (outcome.kind === "cancelled") {
            throw new GitUtilityError(
                "commandFailed",
                `Git command was cancelled (${outcome.reason})`,
            );
        }
        throw new GitUtilityError(
            outcome.code,
            outcome.message,
            outcome.exitCode,
        );
    }
}
