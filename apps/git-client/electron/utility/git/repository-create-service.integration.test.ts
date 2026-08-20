import { spawnSync } from "node:child_process";
import {
    access,
    mkdir,
    mkdtemp,
    readdir,
    realpath,
    rm,
    symlink,
    writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { CloneOptions } from "../../../src/shared/contracts/model/CloneOptions";
import type {
    GitProcessOutcome,
    GitProcessOutput,
    GitProcessSpec,
} from "./git-process";
import type { RepositoryCreateProcessRunnerLike } from "./repository-create-process";
import {
    RepositoryCreateService,
    type RepositoryCreateEvent,
} from "./repository-create-service";

const temporaryDirectories: string[] = [];

function git(cwd: string, ...args: readonly string[]): string {
    const result = spawnSync("git", args, {
        cwd,
        encoding: "utf8",
        env: { ...process.env, GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
        shell: false,
    });
    if (result.status !== 0)
        throw new Error(result.stderr || `git ${args.join(" ")} failed`);
    return result.stdout;
}

async function createTemporaryDirectory(): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), "git-client-create-"));
    temporaryDirectories.push(directory);
    return directory;
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

describe("표면CreateService", () => {
    it("[성공] 메인을 기본 브랜치로 사용하여 어디에서든 유니코드를 찾아보세요", async () => {
        const parent = await createTemporaryDirectory();
        const requestedPath = join(parent, "한글 repository with spaces");
        const events: RepositoryCreateEvent[] = [];
        const service = RepositoryCreateService.create();

        const result = await service.initialize(
            { path: requestedPath, bare: false },
            (event) => events.push(event),
        );

        expect(result).toMatchObject({
            kind: "completed",
            operation: "initialize",
        });
        if (result.kind !== "completed")
            throw new Error(`Initialization failed: ${result.kind}`);
        expect(result.path).toBe(await realpath(requestedPath));
        expect(
            git(requestedPath, "symbolic-ref", "--short", "HEAD").trim(),
        ).toBe("main");
        expect(events.map((event) => event.kind)).toEqual([
            "started",
            "output",
            "completed",
        ]);
        expect(events[0]).toMatchObject({
            kind: "started",
            operation: "initialize",
            displayCommand: expect.stringContaining("git init"),
        });
    });

    it("[실패] 작업용 나무 없이 라이더를 불러함", async () => {
        const parent = await createTemporaryDirectory();
        const requestedPath = join(parent, "server.git");
        const service = RepositoryCreateService.create();

        const result = await service.initialize(
            { path: requestedPath, bare: true },
            () => {},
        );

        expect(result).toMatchObject({
            kind: "completed",
            operation: "initialize",
        });
        expect(
            git(requestedPath, "rev-parse", "--is-bare-repository").trim(),
        ).toBe("true");
        expect(
            git(requestedPath, "rev-parse", "--is-inside-work-tree").trim(),
        ).toBe("false");
    });

    it("[실패] 기존의 릭 링크를 통해 호출할 때 표준을 받고 싶습니다", async () => {
        const parent = await createTemporaryDirectory();
        const actualPath = join(parent, "actual repository");
        const linkedPath = join(parent, "linked repository");
        await mkdir(actualPath);
        await symlink(actualPath, linkedPath);

        const result = await RepositoryCreateService.create().initialize(
            { path: linkedPath, bare: false },
            () => {},
        );

        expect(result).toMatchObject({
            kind: "completed",
            path: await realpath(actualPath),
        });
        expect(git(actualPath, "rev-parse", "--show-toplevel").trim()).toBe(
            await realpath(actualPath),
        );
    });

    it("[성공] 스트리밍 진행을 통해 분기 분기를 단일 분기로 복제함", async () => {
        const parent = await createTemporaryDirectory();
        const source = join(parent, "source repository");
        const destination = join(parent, "cloned repository");
        await RepositoryCreateService.create().initialize(
            { path: source, bare: false },
            () => {},
        );
        git(source, "config", "user.name", "Git Client Test");
        git(source, "config", "user.email", "git-client@example.invalid");
        await writeFile(join(source, "tracked.txt"), "first\n", "utf8");
        git(source, "add", "--", "tracked.txt");
        git(source, "commit", "-m", "first");
        await writeFile(join(source, "tracked.txt"), "second\n", "utf8");
        git(source, "commit", "-am", "second");
        git(source, "switch", "-c", "feature");
        await writeFile(join(source, "feature.txt"), "feature\n", "utf8");
        git(source, "add", "--", "feature.txt");
        git(source, "commit", "-m", "feature");
        const options = {
            depth: 1,
            branch: "feature",
            recurseSubmodules: false,
        } satisfies CloneOptions;
        const events: RepositoryCreateEvent[] = [];

        const result = await RepositoryCreateService.create().clone(
            {
                url: pathToFileURL(source).href,
                path: destination,
                options,
                singleBranch: true,
            },
            (event) => events.push(event),
        );

        expect(result).toMatchObject({ kind: "completed", operation: "clone" });
        expect(git(destination, "branch", "--show-current").trim()).toBe(
            "feature",
        );
        expect(git(destination, "rev-list", "--count", "HEAD").trim()).toBe(
            "1",
        );
        expect(
            git(
                destination,
                "for-each-ref",
                "--format=%(refname)",
                "refs/remotes/origin",
            )
                .trim()
                .split("\n")
                .filter((ref) => ref !== "refs/remotes/origin/HEAD"),
        ).toEqual(["refs/remotes/origin/feature"]);
        expect(events[0]?.kind).toBe("started");
        expect(events.at(-1)?.kind).toBe("completed");
        expect(events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ kind: "progress" }),
            ]),
        );
    });

    it("[성공] 작업이 끝나기 전에 처리해야 하는 상황을 전달함", async () => {
        const parent = await createTemporaryDirectory();
        const destination = join(parent, "destination");
        await mkdir(destination);
        const runner = new ControlledCreateRunner();
        const events: RepositoryCreateEvent[] = [];
        const cloning = RepositoryCreateService.of(runner).clone(
            {
                url: "https://example.invalid/owner/repository.git",
                path: destination,
                options: {
                    depth: null,
                    branch: null,
                    recurseSubmodules: false,
                },
                singleBranch: false,
            },
            (event) => events.push(event),
        );

        await runner.started;
        expect(events).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ kind: "progress", percent: 50 }),
            ]),
        );

        runner.complete();
        await expect(cloning).resolves.toMatchObject({ kind: "completed" });
    });

    it("[실패] 프로세스를 시작하기 위해서는 반드시 Git을 인수해야 함", async () => {
        const runner = new RecordingCreateRunner();
        const events: RepositoryCreateEvent[] = [];

        const result = await RepositoryCreateService.of(runner).clone(
            {
                url: "https://example.invalid/owner/repository.git",
                path: "/tmp/repository",
                options: {
                    depth: null,
                    branch: null,
                    recurseSubmodules: false,
                },
                singleBranch: false,
                args: ["--upload-pack=malicious-helper"],
            },
            (event) => events.push(event),
        );

        expect(result).toMatchObject({ kind: "failed", code: "invalidInput" });
        expect(events.map((event) => event.kind)).toEqual(["failed"]);
        expect(runner.calls).toBe(0);
    });

    it("[실패] 헤드셋 전망을 보고 Git에 직접 전달함", async () => {
        const parent = await createTemporaryDirectory();
        const marker = join(parent, "shell-was-evaluated");
        const destination = join(parent, "destination");

        const result = await RepositoryCreateService.create().clone(
            {
                url: `$(touch ${marker})`,
                path: destination,
                options: {
                    depth: null,
                    branch: null,
                    recurseSubmodules: false,
                },
                singleBranch: false,
            },
            () => {},
        );

        expect(result).toMatchObject({ kind: "failed", operation: "clone" });
        await expect(access(marker)).rejects.toMatchObject({ code: "ENOENT" });
    });

    it("[실패] 임의의 조작음이 있는 Git 원격 메뉴를 차단할 수 있음", async () => {
        const parent = await createTemporaryDirectory();
        const marker = join(parent, "remote-helper-was-evaluated");
        const destination = join(parent, "destination");

        const result = await RepositoryCreateService.create().clone(
            {
                url: `ext::sh -c touch% ${marker}`,
                path: destination,
                options: {
                    depth: null,
                    branch: null,
                    recurseSubmodules: false,
                },
                singleBranch: false,
            },
            () => {},
        );

        expect(result).toMatchObject({ kind: "failed", operation: "clone" });
        await expect(access(marker)).rejects.toMatchObject({ code: "ENOENT" });
    });

    it("[성공] 복제품, 출력 및 터미널 오류에서 자격을 증명할 수 있음", async () => {
        const parent = await createTemporaryDirectory();
        const destination = join(parent, "destination");
        const events: RepositoryCreateEvent[] = [];
        const secretUrl =
            "https://alice:super-secret@example.invalid/repository.git";

        await RepositoryCreateService.of(
            new CredentialFailureRunner(secretUrl),
        ).clone(
            {
                url: secretUrl,
                path: destination,
                options: {
                    depth: null,
                    branch: null,
                    recurseSubmodules: false,
                },
                singleBranch: false,
            },
            (event) => events.push(event),
        );

        const serialized = JSON.stringify(events);
        expect(serialized).not.toContain("alice");
        expect(serialized).not.toContain("super-secret");
        expect(serialized).toContain("[redacted]");
    });

    it("[성공] 복제 실패 후 소유한 스테이징 직원만 제거함", async () => {
        const parent = await createTemporaryDirectory();
        const destination = join(parent, "destination");

        const result = await RepositoryCreateService.of(
            new PartialFailureRunner(),
        ).clone(
            {
                url: "https://example.invalid/owner/repository.git",
                path: destination,
                options: {
                    depth: null,
                    branch: null,
                    recurseSubmodules: false,
                },
                singleBranch: false,
            },
            () => {},
        );

        expect(result).toMatchObject({ kind: "failed" });
        await expect(access(destination)).rejects.toMatchObject({
            code: "ENOENT",
        });
        expect(
            (await readdir(parent)).filter((name) =>
                name.startsWith(".git-client-clone-"),
            ),
        ).toEqual([]);
    });

    it("[실패] 실패 후 원래 사용자 소유 복제 대상을 삭제하지 않음", async () => {
        const parent = await createTemporaryDirectory();
        const destination = join(parent, "existing destination");
        await mkdir(destination);

        const result = await RepositoryCreateService.of(
            new PartialFailureRunner(),
        ).clone(
            {
                url: "https://example.invalid/owner/repository.git",
                path: destination,
                options: {
                    depth: null,
                    branch: null,
                    recurseSubmodules: false,
                },
                singleBranch: false,
            },
            () => {},
        );

        expect(result).toMatchObject({ kind: "failed" });
        await expect(access(destination)).resolves.toBeUndefined();
        await expect(
            access(join(destination, "partial.txt")),
        ).resolves.toBeUndefined();
    });

    it("[성공] 요청 시 하위 모듈을 재귀하게 호출함", async () => {
        const parent = await createTemporaryDirectory();
        const moduleRepository = join(parent, "module source");
        const source = join(parent, "super source");
        const destination = join(parent, "destination");
        const service = RepositoryCreateService.create();
        await service.initialize(
            { path: moduleRepository, bare: false },
            () => {},
        );
        git(moduleRepository, "config", "user.name", "Git Client Test");
        git(
            moduleRepository,
            "config",
            "user.email",
            "git-client@example.invalid",
        );
        await writeFile(
            join(moduleRepository, "module.txt"),
            "module\n",
            "utf8",
        );
        git(moduleRepository, "add", "--", "module.txt");
        git(moduleRepository, "commit", "-m", "module");
        await service.initialize({ path: source, bare: false }, () => {});
        git(source, "config", "user.name", "Git Client Test");
        git(source, "config", "user.email", "git-client@example.invalid");
        git(
            source,
            "-c",
            "protocol.file.allow=always",
            "submodule",
            "add",
            pathToFileURL(moduleRepository).href,
            "vendor/module",
        );
        git(source, "commit", "-am", "add module");
        const previousAllowProtocol = process.env.GIT_ALLOW_PROTOCOL;
        process.env.GIT_ALLOW_PROTOCOL = "file";
        try {
            const result = await service.clone(
                {
                    url: pathToFileURL(source).href,
                    path: destination,
                    options: {
                        depth: null,
                        branch: null,
                        recurseSubmodules: true,
                    },
                    singleBranch: false,
                },
                () => {},
            );

            expect(result).toMatchObject({ kind: "completed" });
            await expect(
                access(join(destination, "vendor/module/module.txt")),
            ).resolves.toBeUndefined();
            expect(git(destination, "submodule", "status").trim()).toMatch(
                /^[0-9a-f]{40}\s+vendor\/module/u,
            );
        } finally {
            if (previousAllowProtocol === undefined)
                delete process.env.GIT_ALLOW_PROTOCOL;
            else process.env.GIT_ALLOW_PROTOCOL = previousAllowProtocol;
        }
    });

    it.each([
        [
            "relative target",
            {
                url: "https://example.invalid/repository.git",
                path: "relative",
                options: {
                    depth: null,
                    branch: null,
                    recurseSubmodules: false,
                },
                singleBranch: false,
            },
        ],
        [
            "zero depth",
            {
                url: "https://example.invalid/repository.git",
                path: "/tmp/repository",
                options: { depth: 0, branch: null, recurseSubmodules: false },
                singleBranch: false,
            },
        ],
        [
            "unsafe branch",
            {
                url: "https://example.invalid/repository.git",
                path: "/tmp/repository",
                options: {
                    depth: null,
                    branch: "--upload-pack=helper",
                    recurseSubmodules: false,
                },
                singleBranch: false,
            },
        ],
        [
            "option-like URL",
            {
                url: "--config=credential.helper=helper",
                path: "/tmp/repository",
                options: {
                    depth: null,
                    branch: null,
                    recurseSubmodules: false,
                },
                singleBranch: false,
            },
        ],
    ])("[실패] 입력된 복제를 입력했습니다: %s", async (_label, request) => {
        const runner = new RecordingCreateRunner();

        const result = await RepositoryCreateService.of(runner).clone(
            request,
            () => {},
        );

        expect(result).toMatchObject({ kind: "failed", code: "invalidInput" });
        expect(runner.calls).toBe(0);
    });

    it("[실패] Git을 시작하기 전에 안전하지 않은 최초의 모든 것을 유지함", async () => {
        const parent = await createTemporaryDirectory();
        const runner = new RecordingCreateRunner();

        const result = await RepositoryCreateService.of(runner).initialize(
            {
                path: join(parent, "repository"),
                bare: false,
                initialBranch: "--template=helper",
            },
            () => {},
        );

        expect(result).toMatchObject({ kind: "failed", code: "invalidInput" });
        expect(runner.calls).toBe(0);
    });

    it("[실패] 생성하기 전에 취소하고 소유한 보안 승인을 제거함", async () => {
        const parent = await createTemporaryDirectory();
        const destination = join(parent, "destination");
        const cancellation = new AbortController();
        cancellation.abort("requested");
        const events: RepositoryCreateEvent[] = [];

        const result = await RepositoryCreateService.create().clone(
            {
                url: "https://example.invalid/repository.git",
                path: destination,
                options: {
                    depth: null,
                    branch: null,
                    recurseSubmodules: false,
                },
                singleBranch: false,
            },
            (event) => events.push(event),
            cancellation.signal,
        );

        expect(result).toMatchObject({
            kind: "cancelled",
            reason: "requested",
        });
        expect(events.map((event) => event.kind)).toEqual([
            "started",
            "cancelled",
        ]);
        await expect(access(destination)).rejects.toMatchObject({
            code: "ENOENT",
        });
        expect(
            (await readdir(parent)).filter((name) =>
                name.startsWith(".git-client-clone-"),
            ),
        ).toEqual([]);
    });
});

class ControlledCreateRunner implements RepositoryCreateProcessRunnerLike {
    readonly started: Promise<void>;
    #markStarted: (() => void) | null = null;
    #complete: ((outcome: GitProcessOutcome) => void) | null = null;

    constructor() {
        this.started = new Promise((resolve) => {
            this.#markStarted = resolve;
        });
    }

    run(
        _spec: GitProcessSpec,
        onOutput: (output: GitProcessOutput) => void,
        _signal?: AbortSignal,
    ): Promise<GitProcessOutcome> {
        onOutput({
            stream: "stderr",
            data: "Receiving objects:  50% (1/2)\r",
        });
        this.#markStarted?.();
        return new Promise((resolve) => {
            this.#complete = resolve;
        });
    }

    complete(): void {
        this.#complete?.({
            kind: "completed",
            exitCode: 0,
            durationMs: 1,
            output: [],
        });
    }
}

class RecordingCreateRunner implements RepositoryCreateProcessRunnerLike {
    calls = 0;

    run(
        _spec: GitProcessSpec,
        _onOutput: (output: GitProcessOutput) => void,
        _signal?: AbortSignal,
    ): Promise<GitProcessOutcome> {
        this.calls += 1;
        return Promise.resolve({
            kind: "completed",
            exitCode: 0,
            durationMs: 1,
            output: [],
        });
    }
}

class CredentialFailureRunner implements RepositoryCreateProcessRunnerLike {
    readonly #secretUrl: string;

    constructor(secretUrl: string) {
        this.#secretUrl = secretUrl;
    }

    run(
        _spec: GitProcessSpec,
        onOutput: (output: GitProcessOutput) => void,
        _signal?: AbortSignal,
    ): Promise<GitProcessOutcome> {
        const message = `fatal: unable to access '${this.#secretUrl}'`;
        onOutput({ stream: "stderr", data: `${message}\n` });
        return Promise.resolve({
            kind: "failed",
            code: "commandFailed",
            message,
            exitCode: 128,
            durationMs: 1,
            output: [{ stream: "stderr", data: message }],
        });
    }
}

class PartialFailureRunner implements RepositoryCreateProcessRunnerLike {
    async run(
        spec: GitProcessSpec,
        _onOutput: (output: GitProcessOutput) => void,
        _signal?: AbortSignal,
    ): Promise<GitProcessOutcome> {
        const processTarget = spec.args.at(-1);
        if (processTarget === undefined)
            throw new Error("Missing clone target");
        await mkdir(processTarget, { recursive: true });
        await writeFile(
            join(processTarget, "partial.txt"),
            "partial\n",
            "utf8",
        );
        return {
            kind: "failed",
            code: "commandFailed",
            message: "clone failed",
            exitCode: 128,
            durationMs: 1,
            output: [],
        };
    }
}
