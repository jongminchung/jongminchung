import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import type {
    GitRequestEvent,
    GitRequestId,
} from "../../../src/shared/contracts/git-utility";
import { VALID_GIT_OPERATIONS } from "../../../src/shared/contracts/git-operation-fixtures";
import {
    GitProcessRunner,
    type GitProcessRunnerLike,
    type GitProcessSpec,
} from "./git-process";
import { GitOperationService } from "./operation-service";
import type { OperationRecoveryRecorder } from "./operation-service";
import { RepositoryRegistry } from "./repository-registry";

const temporaryDirectories: string[] = [];

function git(cwd: string, ...args: readonly string[]): string {
    const result = spawnSync("git", args, {
        cwd,
        env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: "0",
            GIT_OPTIONAL_LOCKS: "0",
            LC_ALL: "C",
        },
        encoding: "utf8",
        shell: false,
    });
    if (result.status !== 0)
        throw new Error(result.stderr || `git ${args.join(" ")} failed`);
    return result.stdout;
}

async function fixture(): Promise<{
    readonly root: string;
    readonly registry: RepositoryRegistry;
    readonly service: GitOperationService;
}> {
    const temporaryDirectory = await mkdtemp(
        join(tmpdir(), "git-client-operation-"),
    );
    temporaryDirectories.push(temporaryDirectory);
    const root = join(temporaryDirectory, "repository");
    await mkdir(root);
    git(root, "init", "--initial-branch=main");
    git(root, "config", "user.name", "Git Client Test");
    git(root, "config", "user.email", "git-client@example.invalid");
    await writeFile(join(root, "tracked.txt"), "initial\n", "utf8");
    git(root, "add", "--", "tracked.txt");
    git(root, "commit", "-m", "initial");
    const runner = new GitProcessRunner();
    const registry = new RepositoryRegistry(runner);
    return {
        root,
        registry,
        service: new GitOperationService(registry, runner),
    };
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

describe("GitOperationService", () => {
    it("records recovery after validation and before the first mutation side effect", async () => {
        const { root, registry } = await fixture();
        const repository = await registry.open(root);
        const order: string[] = [];
        const recovery: OperationRecoveryRecorder = {
            async recordBeforeOperation(
                receivedRepositoryId,
                operation,
            ): Promise<void> {
                expect(receivedRepositoryId).toBe(repository.id);
                expect(operation.kind).toBe("commit");
                order.push("recovery");
            },
        };
        const runner: GitProcessRunnerLike = {
            run: () => {
                order.push("mutation");
                return Promise.resolve({
                    kind: "completed",
                    exitCode: 0,
                    durationMs: 1,
                    output: [],
                });
            },
        };
        const service = new GitOperationService(
            registry,
            runner,
            undefined,
            recovery,
        );

        await expect(
            service.execute(
                crypto.randomUUID() as GitRequestId,
                repository.id,
                {
                    kind: "commit",
                    message: "recorded",
                    amend: false,
                    signOff: false,
                    gpgSign: false,
                },
                () => undefined,
            ),
        ).resolves.toMatchObject({ kind: "completed" });
        expect(order).toEqual(["recovery", "mutation"]);
    });

    it("does not launch a mutation when recovery recording fails", async () => {
        const { root, registry } = await fixture();
        const repository = await registry.open(root);
        const runner: GitProcessRunnerLike = {
            run: () => {
                throw new Error("mutation must not start");
            },
        };
        const recovery: OperationRecoveryRecorder = {
            recordBeforeOperation: () =>
                Promise.reject(new Error("recovery storage unavailable")),
        };
        const service = new GitOperationService(
            registry,
            runner,
            undefined,
            recovery,
        );

        await expect(
            service.execute(
                crypto.randomUUID() as GitRequestId,
                repository.id,
                {
                    kind: "reset",
                    revision: "HEAD",
                    mode: "hard",
                },
                () => undefined,
            ),
        ).resolves.toMatchObject({
            kind: "failed",
            message: "recovery storage unavailable",
        });
    });

    it("dispatches every one of the 51 validated operation variants", async () => {
        const { root, registry } = await fixture();
        const repository = await registry.open(root);
        const specs: GitProcessSpec[] = [];
        const runner: GitProcessRunnerLike = {
            run: (spec) => {
                specs.push(spec);
                return Promise.resolve({
                    kind: "completed",
                    exitCode: 0,
                    durationMs: 1,
                    output: [],
                });
            },
        };
        const service = new GitOperationService(registry, runner);

        expect(VALID_GIT_OPERATIONS).toHaveLength(51);
        expect(new Set(VALID_GIT_OPERATIONS.map(({ kind }) => kind)).size).toBe(
            51,
        );
        for (const operation of VALID_GIT_OPERATIONS) {
            const terminal = await service.execute(
                crypto.randomUUID() as GitRequestId,
                repository.id,
                operation,
                () => undefined,
            );
            expect(terminal.kind, operation.kind).toBe("completed");
        }
        expect(specs).toHaveLength(51);
        expect(
            specs.filter((spec) => spec.editorEnvironment !== undefined),
        ).toHaveLength(4);
    });

    it("stages selected paths and emits one ordered terminal lifecycle", async () => {
        const { root, registry, service } = await fixture();
        await writeFile(join(root, "new.txt"), "new\n", "utf8");
        const repository = await registry.open(root);
        const events: GitRequestEvent[] = [];
        const terminal = await service.execute(
            crypto.randomUUID() as GitRequestId,
            repository.id,
            { kind: "stage", paths: ["new.txt"] },
            (event) => events.push(event),
        );

        expect(terminal.kind).toBe("completed");
        expect(git(root, "diff", "--cached", "--name-only")).toContain(
            "new.txt",
        );
        expect(events[0]?.kind).toBe("started");
        expect(events.at(-1)?.kind).toBe("completed");
        expect(
            events.filter((event) =>
                ["completed", "failed", "cancelled"].includes(event.kind),
            ),
        ).toHaveLength(1);
    });

    it("pipes patch content over stdin instead of argv", async () => {
        const { root, registry, service } = await fixture();
        await writeFile(join(root, "tracked.txt"), "changed\n", "utf8");
        const patch = git(root, "diff", "--", "tracked.txt");
        git(root, "restore", "--", "tracked.txt");
        const repository = await registry.open(root);

        const terminal = await service.execute(
            crypto.randomUUID() as GitRequestId,
            repository.id,
            { kind: "applyPatch", patch, cached: false, reverse: false },
            () => undefined,
        );

        expect(terminal.kind).toBe("completed");
        expect(git(root, "diff", "HEAD", "--", "tracked.txt")).toContain(
            "+changed",
        );
    });

    it("runs an interactive rewrite through a utility-created sequence session", async () => {
        const { root, registry } = await fixture();
        const helperDirectory = join(root, "sequence-helper");
        await build({
            configFile: false,
            logLevel: "silent",
            build: {
                emptyOutDir: true,
                outDir: helperDirectory,
                rollupOptions: {
                    input: fileURLToPath(
                        new URL("./sequence-editor-entry.ts", import.meta.url),
                    ),
                    output: {
                        entryFileNames: "sequence-editor.cjs",
                        format: "cjs",
                    },
                },
                ssr: true,
                target: "node22",
            },
            ssr: { noExternal: true },
        });
        const runner = new GitProcessRunner();
        const service = new GitOperationService(registry, runner, {
            kind: "standalone",
            executablePath: process.execPath,
            entryPath: join(helperDirectory, "sequence-editor.cjs"),
        });
        const repository = await registry.open(root);
        const events: GitRequestEvent[] = [];
        const terminal = await service.execute(
            crypto.randomUUID() as GitRequestId,
            repository.id,
            {
                kind: "interactiveRebase",
                base: null,
                entries: [
                    {
                        oid: git(root, "rev-parse", "HEAD").trim(),
                        subject: "initial",
                        parents: [],
                        action: "pick",
                        message: null,
                        published: false,
                        mergeCommit: false,
                    },
                ],
                options: {
                    autostash: false,
                    updateRefs: false,
                    preserveMerges: false,
                },
            },
            (event) => events.push(event),
        );
        expect(terminal).toMatchObject({ kind: "completed", exitCode: 0 });
        expect(events[0]?.kind).toBe("started");
        expect(
            events.slice(1, -1).every((event) => event.kind === "output"),
        ).toBe(true);
        expect(events.at(-1)?.kind).toBe("completed");
    });

    it("cancels active mutations by request and repository", async () => {
        let resolveRun:
            | ((
                  value: Awaited<ReturnType<GitProcessRunnerLike["run"]>>,
              ) => void)
            | null = null;
        const runner: GitProcessRunnerLike = {
            run: (_spec, signal) =>
                new Promise((resolve) => {
                    resolveRun = resolve;
                    signal?.addEventListener(
                        "abort",
                        () =>
                            resolve({
                                kind: "cancelled",
                                reason:
                                    signal.reason === "repositoryClosed"
                                        ? "repositoryClosed"
                                        : "requested",
                                durationMs: 1,
                                output: [],
                            }),
                        { once: true },
                    );
                }),
        };
        const registry = new RepositoryRegistry(new GitProcessRunner());
        const service = new GitOperationService(registry, runner);
        const { root } = await fixture();
        const repository = await registry.open(root);
        const requestId = crypto.randomUUID() as GitRequestId;
        const pending = service.execute(
            requestId,
            repository.id,
            { kind: "stageAll" },
            () => undefined,
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(service.cancel(requestId)).toBe(true);
        await expect(pending).resolves.toMatchObject({
            kind: "cancelled",
            reason: "requested",
        });
        expect(resolveRun).not.toBeNull();
    });

    it("can cancel synchronously from the started event without launching an uncancellable process", async () => {
        const runner: GitProcessRunnerLike = {
            run: (_spec, signal) =>
                Promise.resolve(
                    signal?.aborted === true
                        ? {
                              kind: "cancelled",
                              reason: "requested",
                              durationMs: 0,
                              output: [],
                          }
                        : {
                              kind: "completed",
                              exitCode: 0,
                              durationMs: 0,
                              output: [],
                          },
                ),
        };
        const registry = new RepositoryRegistry(new GitProcessRunner());
        const service = new GitOperationService(registry, runner);
        const { root } = await fixture();
        const repository = await registry.open(root);
        const requestId = crypto.randomUUID() as GitRequestId;

        const terminal = await service.execute(
            requestId,
            repository.id,
            { kind: "stageAll" },
            (event) => {
                if (event.kind === "started") {
                    expect(service.cancel(requestId)).toBe(true);
                }
            },
        );

        expect(terminal).toMatchObject({
            kind: "cancelled",
            reason: "requested",
        });
    });
});
