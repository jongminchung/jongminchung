import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
    access,
    chmod,
    mkdtemp,
    mkdir,
    realpath,
    rm,
    writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { v5 as uuidV5 } from "uuid";
import { afterEach, describe, expect, it } from "vitest";
import {
    parseLog,
    parseRefs,
    parseStashList,
    parseStatusV2,
} from "../../../src/domain/parsers";
import {
    type GitCreationEvent,
    type GitQueryRequest,
    type GitRequestEvent,
    type GitRequestId,
    type RepositoryChangedEvent,
    type RepositoryChangedListener,
    type RepositoryId,
} from "../../../src/shared/contracts/git-utility";
import { GitProcessRunner } from "./git-process";
import { GitUtility } from "./git-utility";
import { GitQueryService } from "./query-service";
import { redactCredentials } from "./redaction";
import type {
    RepositoryCreateListener,
    RepositoryCreateTerminalEvent,
} from "./repository-create-service";
import { RepositoryRegistry } from "./repository-registry";

const temporaryDirectories: string[] = [];
const GIT_ENVIRONMENT = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_PAGER: "cat",
    GIT_OPTIONAL_LOCKS: "0",
    LC_ALL: "C",
};

function git(cwd: string, ...args: readonly string[]): string {
    const result = spawnSync("git", args, {
        cwd,
        env: GIT_ENVIRONMENT,
        encoding: "utf8",
        shell: false,
    });
    if (result.status !== 0)
        throw new Error(result.stderr || `git ${args.join(" ")} failed`);
    return result.stdout;
}

async function createFixtureRepository(): Promise<string> {
    const temporaryDirectory = await mkdtemp(
        join(tmpdir(), "git-client-electron-"),
    );
    temporaryDirectories.push(temporaryDirectory);
    const repository = join(temporaryDirectory, "한글 repository with spaces");
    await mkdir(repository);
    git(repository, "init", "--initial-branch=main");
    git(repository, "config", "user.name", "Git Client Test");
    git(repository, "config", "user.email", "git-client@example.invalid");
    await writeFile(join(repository, "tracked.txt"), "first\n", "utf8");
    git(repository, "add", "--", "tracked.txt");
    git(repository, "commit", "-m", "첫 commit");
    return repository;
}

function query(
    kind: GitQueryRequest["kind"],
    repositoryId: RepositoryId,
    properties: Partial<
        Extract<GitQueryRequest, Readonly<{ kind: "log" }>>
    > = {},
): GitQueryRequest {
    if (kind === "log") {
        return {
            kind,
            repositoryId,
            requestId: randomUUID() as GitRequestId,
            skip: 0,
            limit: 1_000,
            order: "topology",
            filters: {
                query: null,
                branch: null,
                author: null,
                since: null,
                until: null,
                paths: [],
                noMerges: false,
            },
            ...properties,
        };
    }
    return {
        kind,
        repositoryId,
        requestId: randomUUID() as GitRequestId,
        ...properties,
    } as GitQueryRequest;
}

async function execute(
    service: GitQueryService,
    request: GitQueryRequest,
): Promise<readonly GitRequestEvent[]> {
    const events: GitRequestEvent[] = [];
    await service.execute(request, (event) => {
        events.push(event);
    });
    return events;
}

function stdout(events: readonly GitRequestEvent[]): string {
    return events
        .filter((event) => event.kind === "output" && event.stream === "stdout")
        .map((event) => (event.kind === "output" ? event.data : ""))
        .join("");
}

afterEach(async () => {
    await Promise.all(
        temporaryDirectories
            .splice(0)
            .map((directory) =>
                rm(directory, { recursive: true, force: true }),
            ),
    );
});

describe("Electron Git utility", () => {
    it("initializes, registers, and immediately queries a repository", async () => {
        const parent = await mkdtemp(
            join(tmpdir(), "git-client-electron-create-"),
        );
        temporaryDirectories.push(parent);
        const repository = join(parent, "initialized repository");
        const utility = new GitUtility();
        const requestId = randomUUID() as GitRequestId;
        const events: GitCreationEvent[] = [];

        const terminal = await utility.initializeRepository(
            { requestId, path: repository, bare: false },
            (event) => events.push(event),
        );

        expect(terminal).toMatchObject({
            kind: "completed",
            requestId,
            operation: "initialize",
            repository: { path: await realpath(repository), isBare: false },
        });
        expect(events.map((event) => event.kind)).toEqual([
            "started",
            "output",
            "completed",
        ]);
        if (terminal.kind !== "completed")
            throw new Error(`Initialization failed: ${terminal.kind}`);
        expect(utility.listRepositories()).toEqual([terminal.repository]);
        const statusEvents: GitRequestEvent[] = [];
        await utility.executeQuery(
            query("status", terminal.repository.id),
            (event) => statusEvents.push(event),
        );
        expect(statusEvents.at(-1)?.kind).toBe("completed");
    });

    it("clones, registers, and immediately queries a repository", async () => {
        const source = await createFixtureRepository();
        const parent = await mkdtemp(
            join(tmpdir(), "git-client-electron-clone-"),
        );
        temporaryDirectories.push(parent);
        const destination = join(parent, "cloned repository");
        const utility = new GitUtility();
        const requestId = randomUUID() as GitRequestId;
        const events: GitCreationEvent[] = [];

        const terminal = await utility.cloneRepository(
            {
                requestId,
                url: pathToFileURL(source).href,
                path: destination,
                options: {
                    depth: null,
                    branch: null,
                    recurseSubmodules: false,
                },
            },
            (event) => events.push(event),
        );

        expect(terminal).toMatchObject({
            kind: "completed",
            requestId,
            operation: "clone",
            repository: { path: await realpath(destination), isBare: false },
        });
        expect(events[0]?.kind).toBe("started");
        expect(events.at(-1)?.kind).toBe("completed");
        expect(events.some((event) => event.kind === "progress")).toBe(true);
        if (terminal.kind !== "completed")
            throw new Error(`Clone failed: ${terminal.kind}`);
        const logEvents: GitRequestEvent[] = [];
        await utility.executeQuery(
            query("log", terminal.repository.id, { limit: 1 }),
            (event) => logEvents.push(event),
        );
        expect(parseLog(stdout(logEvents))).toEqual([
            expect.objectContaining({ subject: "첫 commit" }),
        ]);
    });

    it("cancels repository creation through its active AbortController", async () => {
        const creator = new WaitingRepositoryCreator();
        const utility = new GitUtility(creator);
        const requestId = randomUUID() as GitRequestId;
        const events: GitCreationEvent[] = [];
        const creating = utility.initializeRepository(
            {
                requestId,
                path: "/tmp/not-created-by-waiting-runner",
                bare: false,
            },
            (event) => events.push(event),
        );
        await creator.started;

        expect(utility.cancelQuery(requestId)).toBe(true);
        await expect(creating).resolves.toMatchObject({
            kind: "cancelled",
            requestId,
            reason: "requested",
        });
        expect(creator.signal?.aborted).toBe(true);
        expect(events.map((event) => event.kind)).toEqual([
            "started",
            "cancelled",
        ]);
    });

    it("opens a canonical Unicode/space path with the Rust-compatible URL namespace UUID", async () => {
        const repository = await createFixtureRepository();
        const runner = new GitProcessRunner();
        const registry = new RepositoryRegistry(runner);

        const record = await registry.open(repository);
        const canonicalPath = await realpath(repository);

        expect(record.path).toBe(canonicalPath);
        expect(record.id).toBe(uuidV5(canonicalPath, uuidV5.URL));
        expect(
            record.gitVersion.major > 2 || record.gitVersion.minor >= 39,
        ).toBe(true);
        expect(registry.get(record.id)).toBe(record);
        expect(registry.close(record.id)).toBe(true);
        expect(() => registry.get(record.id)).toThrow("Repository is not open");
    });

    it("inspects complete snapshot fields through the utility public API", async () => {
        const repository = await createFixtureRepository();
        git(
            repository,
            "remote",
            "add",
            "origin",
            "https://user:secret@example.invalid/repository.git",
        );
        const utility = new GitUtility();
        const record = await utility.openRepository({ path: repository });

        await expect(utility.inspectSnapshot(record.id)).resolves.toMatchObject(
            {
                id: record.id,
                currentBranch: "main",
                headOid: expect.stringMatching(/^[0-9a-f]{40}$/u),
                remoteUrl: "https://[redacted]@example.invalid/repository.git",
                ahead: 0,
                behind: 0,
                isShallow: false,
                isDetached: false,
                hasCommits: true,
                operation: null,
            },
        );
    });

    it("executes every typed repository-inspection and ignore-rules request on a real fixture", async () => {
        const repository = await createFixtureRepository();
        git(
            repository,
            "remote",
            "add",
            "origin",
            "https://user:secret@example.invalid/repository.git",
        );
        const utility = new GitUtility();
        const record = await utility.openRepository({ path: repository });

        await expect(
            utility.executeRepositoryService({
                operation: "compareBranches",
                repositoryId: record.id,
                left: "main",
                right: "HEAD",
            }),
        ).resolves.toMatchObject({
            operation: "compareBranches",
            value: { ahead: 0, behind: 0, leftOnly: [], rightOnly: [] },
        });
        await expect(
            utility.executeRepositoryService({
                operation: "preCommitCheck",
                repositoryId: record.id,
            }),
        ).resolves.toMatchObject({
            operation: "preCommitCheck",
            value: {
                branch: "main",
                detachedHead: false,
                protectedBranch: true,
            },
        });
        await expect(
            utility.executeRepositoryService({
                operation: "listGitConfig",
                repositoryId: record.id,
            }),
        ).resolves.toMatchObject({
            operation: "listGitConfig",
            value: expect.any(Array),
        });
        await expect(
            utility.executeRepositoryService({
                operation: "listSubmodules",
                repositoryId: record.id,
            }),
        ).resolves.toEqual({ operation: "listSubmodules", value: [] });
        await expect(
            utility.executeRepositoryService({
                operation: "listMergedBranches",
                repositoryId: record.id,
                target: "HEAD",
            }),
        ).resolves.toMatchObject({
            operation: "listMergedBranches",
            value: ["main"],
        });
        await expect(
            utility.executeRepositoryService({
                operation: "loadCommitSignature",
                repositoryId: record.id,
                revision: "HEAD",
            }),
        ).resolves.toMatchObject({
            operation: "loadCommitSignature",
            value: { status: "N" },
        });
        await expect(
            utility.executeRepositoryService({
                operation: "listRemotes",
                repositoryId: record.id,
            }),
        ).resolves.toMatchObject({
            operation: "listRemotes",
            value: [
                {
                    name: "origin",
                    fetchUrl:
                        "https://[redacted]@example.invalid/repository.git",
                    pushUrl:
                        "https://[redacted]@example.invalid/repository.git",
                },
            ],
        });
        await expect(
            utility.executeRepositoryService({
                operation: "listWorktrees",
                repositoryId: record.id,
            }),
        ).resolves.toMatchObject({
            operation: "listWorktrees",
            value: [
                {
                    path: await realpath(repository),
                    branch: "main",
                    isMain: true,
                },
            ],
        });
        await expect(
            utility.executeRepositoryService({
                operation: "writeIgnoreRules",
                repositoryId: record.id,
                rules: { gitignore: "dist/\n", infoExclude: ".cache/\n" },
            }),
        ).resolves.toEqual({ operation: "writeIgnoreRules" });
        await expect(
            utility.executeRepositoryService({
                operation: "readIgnoreRules",
                repositoryId: record.id,
            }),
        ).resolves.toEqual({
            operation: "readIgnoreRules",
            value: { gitignore: "dist/\n", infoExclude: ".cache/\n" },
        });
    });

    it("queries porcelain-v2 status, refs, log, and stashes with ordered terminal events", async () => {
        const repository = await createFixtureRepository();
        const runner = new GitProcessRunner();
        const registry = new RepositoryRegistry(runner);
        const service = new GitQueryService(registry, runner);
        const record = await registry.open(repository);
        await writeFile(
            join(repository, "새 파일 with space.txt"),
            "untracked\n",
            "utf8",
        );

        const statusEvents = await execute(service, query("status", record.id));
        expect(statusEvents[0]?.kind).toBe("started");
        expect(statusEvents.at(-1)?.kind).toBe("completed");
        expect(
            statusEvents.slice(1, -1).every((event) => event.kind === "output"),
        ).toBe(true);
        expect(stdout(statusEvents)).toContain("새 파일 with space.txt");
        expect(parseStatusV2(stdout(statusEvents)).changes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    path: "새 파일 with space.txt",
                    status: "untracked",
                }),
            ]),
        );

        const refsEvents = await execute(service, query("refs", record.id));
        expect(stdout(refsEvents)).toContain("refs/heads/main");
        expect(parseRefs(stdout(refsEvents))).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    name: "refs/heads/main",
                    current: true,
                }),
            ]),
        );

        const logEvents = await execute(
            service,
            query("log", record.id, {
                limit: 20,
                filters: {
                    query: null,
                    branch: "HEAD",
                    author: null,
                    since: null,
                    until: null,
                    paths: [],
                    noMerges: false,
                },
            }),
        );
        expect(stdout(logEvents)).toContain("첫 commit");
        expect(parseLog(stdout(logEvents))).toEqual([
            expect.objectContaining({
                subject: "첫 commit",
                author: "Git Client Test",
            }),
        ]);

        await writeFile(join(repository, "tracked.txt"), "changed\n", "utf8");
        git(repository, "stash", "push", "-m", "검증 stash");
        const stashEvents = await execute(
            service,
            query("stashList", record.id),
        );
        expect(stdout(stashEvents)).toContain("검증 stash");
        expect(parseStashList(stdout(stashEvents))).toEqual([
            expect.objectContaining({
                selector: "stash@{0}",
                subject: expect.stringContaining("검증 stash"),
            }),
        ]);
    });

    it("runs a bounded read-only working-tree diff with the native parity options", async () => {
        const repository = await createFixtureRepository();
        await writeFile(join(repository, "tracked.txt"), "second\n", "utf8");
        const utility = new GitUtility();
        const record = await utility.openRepository({ path: repository });
        const events: GitRequestEvent[] = [];

        const terminal = await utility.executeQuery(
            {
                kind: "diff",
                repositoryId: record.id,
                requestId: randomUUID() as GitRequestId,
                from: null,
                to: null,
                paths: ["tracked.txt"],
                staged: false,
                options: { whitespace: "show", contextLines: 3 },
            },
            (event) => events.push(event),
        );

        expect(terminal.kind).toBe("completed");
        expect(events.map((event) => event.kind)).toEqual([
            "started",
            "output",
            "completed",
        ]);
        expect(stdout(events)).toContain("+second");
    });

    it("dispatches a mutation through the same request lifecycle and cancellation surface", async () => {
        const repository = await createFixtureRepository();
        await writeFile(join(repository, "new.txt"), "new\n", "utf8");
        const utility = new GitUtility();
        const record = await utility.openRepository({ path: repository });
        const events: GitRequestEvent[] = [];

        const terminal = await utility.executeQuery(
            {
                kind: "operation",
                requestId: randomUUID() as GitRequestId,
                repositoryId: record.id,
                operation: { kind: "stage", paths: ["new.txt"] },
            },
            (event) => events.push(event),
        );

        expect(terminal.kind).toBe("completed");
        expect(events.map(({ kind }) => kind)).toEqual([
            "started",
            "completed",
        ]);
        expect(git(repository, "diff", "--cached", "--name-only")).toContain(
            "new.txt",
        );
    });

    it("reads bounded worktree, index, revision, and image content by repository id", async () => {
        const repository = await createFixtureRepository();
        await writeFile(join(repository, "tracked.txt"), "second\n", "utf8");
        await writeFile(
            join(repository, "image.png"),
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        );
        const utility = new GitUtility();
        const record = await utility.openRepository({ path: repository });

        await expect(
            utility.readFile(record.id, { kind: "workingTree" }, "tracked.txt"),
        ).resolves.toMatchObject({ kind: "text", content: "second\n" });
        await expect(
            utility.readFile(record.id, { kind: "index" }, "tracked.txt"),
        ).resolves.toMatchObject({ kind: "text", content: "first\n" });
        await expect(
            utility.readFile(
                record.id,
                { kind: "revision", revision: "HEAD" },
                "tracked.txt",
            ),
        ).resolves.toMatchObject({ kind: "text", content: "first\n" });
        await expect(
            utility.readFilePreview(
                record.id,
                { kind: "workingTree" },
                "image.png",
            ),
        ).resolves.toMatchObject({
            kind: "image",
            preview: {
                mimeType: "image/png",
                dataUrl: expect.stringContaining("base64,"),
            },
        });
    });

    it("owns watcher registration and closes it with the repository", async () => {
        const repository = await createFixtureRepository();
        const watcher = new FakeRepositoryWatcher();
        const utility = new GitUtility(undefined, () => watcher);
        const record = await utility.openRepository({ path: repository });
        const events: RepositoryChangedEvent[] = [];

        await utility.watchRepository(record.id, (event) => events.push(event));
        watcher.emit({
            repositoryId: record.id,
            invalidations: ["status", "history"],
        });
        expect(events).toEqual([
            { repositoryId: record.id, invalidations: ["status", "history"] },
        ]);

        expect(utility.closeRepository(record.id)).toBe(true);
        expect(watcher.unwatched).toEqual([record.id]);
    });

    it("strictly rejects an unsafe request before starting a process", async () => {
        const repository = await createFixtureRepository();
        const runner = new GitProcessRunner();
        const registry = new RepositoryRegistry(runner);
        const service = new GitQueryService(registry, runner);
        const record = await registry.open(repository);
        const events: GitRequestEvent[] = [];
        await expect(
            service.execute(
                query("log", record.id, {
                    filters: {
                        query: null,
                        branch: "--exec=unsafe",
                        author: null,
                        since: null,
                        until: null,
                        paths: [],
                        noMerges: false,
                    },
                }),
                (event) => events.push(event),
            ),
        ).rejects.toMatchObject({ code: "invalidInput" });
        expect(events).toEqual([]);
    });

    it("bounds captured output instead of returning an unbounded Git response", async () => {
        const repository = await createFixtureRepository();
        await writeFile(
            join(repository, "large.txt"),
            "token=x\n".repeat(16 * 1024),
            "utf8",
        );
        git(repository, "add", "--", "large.txt");
        git(repository, "commit", "-m", "large output");
        const runner = new GitProcessRunner();

        const outcome = await runner.run({
            cwd: repository,
            args: ["show", "--no-color", "HEAD"],
            outputLimitBytes: 1_024,
        });

        expect(outcome).toMatchObject({ kind: "failed", code: "outputLimit" });
        expect(
            outcome.output.reduce(
                (size, entry) => size + Buffer.byteLength(entry.data),
                0,
            ),
        ).toBeLessThanOrEqual(1_024);
        expect(
            outcome.output.map((entry) => entry.data).join(""),
        ).not.toContain("token=x");
    });

    it("cancels an active query when its repository is closed", async () => {
        const repository = await createFixtureRepository();
        const registry = new RepositoryRegistry(new GitProcessRunner());
        const record = await registry.open(repository);
        const blockingGit = join(repository, "blocking-git");
        const childStarted = join(repository, "child-started.marker");
        await writeFile(
            blockingGit,
            [
                `#!${process.execPath}`,
                `require("node:fs").writeFileSync(${JSON.stringify(childStarted)}, "started");`,
                `process.stdout.write("child started\\n");`,
                "setInterval(() => undefined, 1_000);",
                "",
            ].join("\n"),
            "utf8",
        );
        await chmod(blockingGit, 0o755);
        const service = new GitQueryService(
            registry,
            new GitProcessRunner(blockingGit),
        );
        const request = query("status", record.id);
        const events: GitRequestEvent[] = [];

        const terminalPromise = service.execute(request, (event) => {
            events.push(event);
        });
        for (let attempt = 0; attempt < 100; attempt += 1) {
            try {
                await access(childStarted);
                break;
            } catch {
                await new Promise((resolve) => setTimeout(resolve, 5));
            }
        }
        await expect(access(childStarted)).resolves.toBeUndefined();
        expect(service.cancelRepository(record.id)).toBe(1);
        registry.close(record.id);
        const terminal = await terminalPromise;

        expect(terminal).toMatchObject({
            kind: "cancelled",
            reason: "repositoryClosed",
        });
        expect(events[0]?.kind).toBe("started");
        expect(
            events.slice(1, -1).every((event) => event.kind === "output"),
        ).toBe(true);
        expect(events.at(-1)?.kind).toBe("cancelled");
        expect(service.activeCount).toBe(0);
    });

    it("makes a request cancellable before delivering its started event", async () => {
        const repository = await createFixtureRepository();
        const runner = new GitProcessRunner();
        const registry = new RepositoryRegistry(runner);
        const record = await registry.open(repository);
        const service = new GitQueryService(registry, runner);
        const request = query("status", record.id);
        const events: GitRequestEvent[] = [];

        const terminal = await service.execute(request, (event) => {
            events.push(event);
            if (event.kind === "started")
                expect(service.cancel(request.requestId)).toBe(true);
        });

        expect(terminal).toMatchObject({
            kind: "cancelled",
            reason: "requested",
        });
        expect(events.map((event) => event.kind)).toEqual([
            "started",
            "cancelled",
        ]);
        expect(service.activeCount).toBe(0);
    });

    it("redacts URL, header, query, GitHub, and GitLab credentials", () => {
        const value = [
            "https://alice:secret@example.test/repository",
            "Authorization: Bearer bearer-secret",
            "token=query-secret&next=1",
            `ghp_${"a".repeat(32)}`,
            `glpat-${"b".repeat(32)}`,
        ].join("\n");
        const redacted = redactCredentials(value);

        expect(redacted).not.toContain("secret");
        expect(redacted).not.toContain(`ghp_${"a".repeat(32)}`);
        expect(redacted).not.toContain(`glpat-${"b".repeat(32)}`);
        expect(redacted.match(/\[redacted\]/gu)?.length).toBeGreaterThanOrEqual(
            5,
        );
    });
});

class FakeRepositoryWatcher {
    readonly unwatched: RepositoryId[] = [];
    listener: RepositoryChangedListener | null = null;

    async watch(
        _repositoryId: RepositoryId,
        listener: RepositoryChangedListener,
    ): Promise<void> {
        this.listener = listener;
    }

    async unwatch(repositoryId: RepositoryId): Promise<void> {
        this.unwatched.push(repositoryId);
        this.listener = null;
    }

    emit(event: RepositoryChangedEvent): void {
        this.listener?.(event);
    }
}

class WaitingRepositoryCreator {
    readonly started: Promise<void>;
    signal: AbortSignal | null = null;
    #markStarted: (() => void) | null = null;

    constructor() {
        this.started = new Promise((resolve) => {
            this.#markStarted = resolve;
        });
    }

    initialize(
        _request: unknown,
        listener: RepositoryCreateListener,
        signal?: AbortSignal,
    ): Promise<RepositoryCreateTerminalEvent> {
        return this.#wait("initialize", listener, signal);
    }

    clone(
        _request: unknown,
        listener: RepositoryCreateListener,
        signal?: AbortSignal,
    ): Promise<RepositoryCreateTerminalEvent> {
        return this.#wait("clone", listener, signal);
    }

    #wait(
        operation: "initialize" | "clone",
        listener: RepositoryCreateListener,
        signal?: AbortSignal,
    ): Promise<RepositoryCreateTerminalEvent> {
        if (signal === undefined)
            throw new Error("Expected a creation AbortSignal");
        this.signal = signal;
        listener({
            kind: "started",
            operation,
            displayCommand: `git ${operation}`,
            startedAtMs: 1,
        });
        this.#markStarted?.();
        return new Promise((resolve) => {
            signal.addEventListener(
                "abort",
                () => {
                    const terminal: RepositoryCreateTerminalEvent = {
                        kind: "cancelled",
                        operation,
                        reason: "requested",
                        durationMs: 1,
                    };
                    listener(terminal);
                    resolve(terminal);
                },
                { once: true },
            );
        });
    }
}
