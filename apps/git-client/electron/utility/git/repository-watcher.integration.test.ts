import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RepositoryChangedEvent } from "../../../src/shared/contracts/model";
import { GitProcessRunner } from "./git-process";
import { RepositoryRegistry } from "./repository-registry";
import {
    RepositoryWatcherService,
    type RepositoryWatchSource,
    type RepositoryWatchSubscription,
} from "./repository-watcher";

const temporaryDirectories: string[] = [];
const watcherServices: RepositoryWatcherService[] = [];

class FakeRepositoryWatchSource implements RepositoryWatchSource {
    readonly #listeners = new Map<string, Set<(path: string) => void>>();
    readonly #errorListeners = new Map<string, Set<(error: Error) => void>>();
    #failedSubscriptions = 0;
    subscriptionAttempts = 0;

    subscribe(
        root: string,
        listener: (path: string) => void,
        onError: (error: Error) => void = () => undefined,
    ): RepositoryWatchSubscription {
        this.subscriptionAttempts += 1;
        if (this.#failedSubscriptions > 0) {
            this.#failedSubscriptions -= 1;
            throw new Error("Injected repository watcher subscription failure");
        }
        const listeners =
            this.#listeners.get(root) ?? new Set<(path: string) => void>();
        const errorListeners =
            this.#errorListeners.get(root) ?? new Set<(error: Error) => void>();
        listeners.add(listener);
        errorListeners.add(onError);
        this.#listeners.set(root, listeners);
        this.#errorListeners.set(root, errorListeners);
        return {
            close: () => {
                listeners.delete(listener);
                errorListeners.delete(onError);
                if (listeners.size === 0) this.#listeners.delete(root);
                if (errorListeners.size === 0)
                    this.#errorListeners.delete(root);
            },
        };
    }

    failNextSubscriptions(count = 1): void {
        this.#failedSubscriptions = count;
    }

    emitError(root: string): void {
        for (const listener of this.#errorListeners.get(root) ?? []) {
            listener(new Error("Injected repository watcher runtime failure"));
        }
    }

    emit(path: string): void {
        for (const [root, listeners] of this.#listeners) {
            if (path !== root && !path.startsWith(`${root}/`)) continue;
            for (const listener of listeners) listener(path);
        }
    }

    get roots(): readonly string[] {
        return [...this.#listeners.keys()];
    }
}

function git(cwd: string, ...args: readonly string[]): string {
    const result = spawnSync("git", args, {
        cwd,
        env: {
            ...process.env,
            GIT_TERMINAL_PROMPT: "0",
            GIT_PAGER: "cat",
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

async function createFixture(): Promise<{
    readonly root: string;
    readonly gitDirectory: string;
    readonly commonDirectory: string;
    readonly registry: RepositoryRegistry;
    readonly repositoryId: string;
    readonly service: RepositoryWatcherService;
    readonly source: FakeRepositoryWatchSource;
}> {
    const temporaryDirectory = await mkdtemp(
        join(tmpdir(), "git-client-watcher-"),
    );
    temporaryDirectories.push(temporaryDirectory);
    const root = join(temporaryDirectory, "repository");
    await mkdir(root);
    git(root, "init", "--initial-branch=main");
    git(root, "config", "user.name", "Git Client Test");
    git(root, "config", "user.email", "git-client@example.invalid");
    await writeFile(join(root, "tracked.txt"), "first\n", "utf8");
    git(root, "add", "--", "tracked.txt");
    git(root, "commit", "-m", "initial");
    const registry = new RepositoryRegistry(new GitProcessRunner());
    const record = await registry.open(root);
    const source = new FakeRepositoryWatchSource();
    const service = RepositoryWatcherService.of(registry, {
        debounceMs: 40,
        reconnectInitialDelayMs: 5,
        reconnectMaxDelayMs: 10,
        source,
    });
    watcherServices.push(service);
    return {
        root: record.path,
        gitDirectory: record.gitDirectory,
        commonDirectory: record.commonDirectory,
        registry,
        repositoryId: record.id,
        service,
        source,
    };
}

function nextEvent(
    events: RepositoryChangedEvent[],
): Promise<RepositoryChangedEvent> {
    return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const poll = (): void => {
            const event = events.shift();
            if (event !== undefined) {
                resolve(event);
                return;
            }
            if (Date.now() - startedAt > 3_000) {
                reject(
                    new Error("Timed out waiting for repository watcher event"),
                );
                return;
            }
            setTimeout(poll, 10);
        };
        poll();
    });
}

function delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitUntil(predicate: () => boolean): Promise<void> {
    const startedAt = Date.now();
    while (!predicate()) {
        if (Date.now() - startedAt > 3_000) {
            throw new Error("Timed out waiting for repository watcher state");
        }
        await delay(5);
    }
}

afterEach(async () => {
    await Promise.all(
        watcherServices.splice(0).map((service) => service.dispose()),
    );
    await Promise.all(
        temporaryDirectories
            .splice(0)
            .map((directory) =>
                rm(directory, { recursive: true, force: true }),
            ),
    );
});

describe("마주감시자서비스", () => {
    it("[성공] 이후의 거부가 성공할 수 있도록 처음부터 구독하지 못하게 정리함", async () => {
        const { root, repositoryId, service, source } = await createFixture();
        const events: RepositoryChangedEvent[] = [];
        source.failNextSubscriptions();

        await expect(
            service.watch(repositoryId, (event) => events.push(event)),
        ).rejects.toThrow("Injected repository watcher subscription failure");
        await expect(
            service.watch(repositoryId, (event) => events.push(event)),
        ).resolves.toBeUndefined();
        source.emit(join(root, "tracked.txt"));

        await expect(nextEvent(events)).resolves.toEqual({
            repositoryId,
            invalidations: ["status"],
        });
    });

    it("[성공] 본능적으로 다시 연결하고 백오프를 사용하여 다시 연결을 다시 시도함", async () => {
        const { root, repositoryId, service, source } = await createFixture();
        const events: RepositoryChangedEvent[] = [];
        await service.watch(repositoryId, (event) => events.push(event));
        expect(source.subscriptionAttempts).toBe(1);

        source.failNextSubscriptions();
        source.emitError(root);
        await waitUntil(
            () =>
                source.subscriptionAttempts === 3 && source.roots.length === 1,
        );

        await expect(nextEvent(events)).resolves.toEqual({
            repositoryId,
            invalidations: [
                "status",
                "history",
                "stash",
                "operation",
                "management",
            ],
        });
        source.emit(join(root, "tracked.txt"));
        await expect(nextEvent(events)).resolves.toEqual({
            repositoryId,
            invalidations: ["status"],
        });
    });

    it("[성공] 작업이 변경되면 상태를 내보냅니다", async () => {
        const { root, repositoryId, service, source } = await createFixture();
        const events: RepositoryChangedEvent[] = [];
        await service.watch(repositoryId, (event) => events.push(event));

        await writeFile(join(root, "tracked.txt"), "changed\n", "utf8");
        source.emit(join(root, "tracked.txt"));

        await expect(nextEvent(events)).resolves.toEqual({
            repositoryId,
            invalidations: ["status"],
        });
    });

    it("[성공] HEAD가 변경되면서 상태 및 기록이 초기화되었습니다", async () => {
        const { gitDirectory, repositoryId, service, source } =
            await createFixture();
        const events: RepositoryChangedEvent[] = [];
        await service.watch(repositoryId, (event) => events.push(event));

        const headPath = join(gitDirectory, "HEAD");
        source.emit(headPath);

        await expect(nextEvent(events)).resolves.toEqual({
            repositoryId,
            invalidations: ["status", "history"],
        });
    });

    it("[성공] Git이 바뀌었다가 다시 화됨", async () => {
        const { gitDirectory, repositoryId, service, source } =
            await createFixture();
        const events: RepositoryChangedEvent[] = [];
        await service.watch(repositoryId, (event) => events.push(event));

        source.emit(join(gitDirectory, "index"));

        await expect(nextEvent(events)).resolves.toEqual({
            repositoryId,
            invalidations: ["status"],
        });
    });

    it("[성공] 기록을 바꾸다", async () => {
        const { gitDirectory, repositoryId, service, source } =
            await createFixture();
        const events: RepositoryChangedEvent[] = [];
        await service.watch(repositoryId, (event) => events.push(event));

        source.emit(join(gitDirectory, "refs", "heads", "feature"));

        await expect(nextEvent(events)).resolves.toEqual({
            repositoryId,
            invalidations: ["history"],
        });
    });

    it("[성공] 참조/스태시가 변경된 상태, 기록 및 스태시상태를 초기화함", async () => {
        const { gitDirectory, repositoryId, service, source } =
            await createFixture();
        const events: RepositoryChangedEvent[] = [];
        await service.watch(repositoryId, (event) => events.push(event));

        source.emit(join(gitDirectory, "refs", "stash"));

        await expect(nextEvent(events)).resolves.toEqual({
            repositoryId,
            invalidations: ["status", "history", "stash"],
        });
    });

    it("[성공] Git 구성이 변경되면 다시 관리됨", async () => {
        const { gitDirectory, repositoryId, service, source } =
            await createFixture();
        const events: RepositoryChangedEvent[] = [];
        await service.watch(repositoryId, (event) => events.push(event));

        source.emit(join(gitDirectory, "config"));

        await expect(nextEvent(events)).resolves.toEqual({
            repositoryId,
            invalidations: ["management"],
        });
    });

    it("[성공] 임시 임시 데이터가 변경되면 상태 및 작업 상태를 초기화함", async () => {
        const { gitDirectory, repositoryId, service, source } =
            await createFixture();
        const events: RepositoryChangedEvent[] = [];
        await service.watch(repositoryId, (event) => events.push(event));

        source.emit(join(gitDirectory, "MERGE_HEAD"));

        await expect(nextEvent(events)).resolves.toEqual({
            repositoryId,
            invalidations: ["status", "operation"],
        });
    });

    it("[성공] 버스트를 대신하여 하나의 복귀화 이벤트로 디바운싱함", async () => {
        const { root, gitDirectory, repositoryId, service, source } =
            await createFixture();
        const events: RepositoryChangedEvent[] = [];
        await service.watch(repositoryId, (event) => events.push(event));

        source.emit(join(gitDirectory, "config"));
        source.emit(join(gitDirectory, "refs", "heads", "feature"));
        source.emit(join(root, "tracked.txt"));

        await expect(nextEvent(events)).resolves.toEqual({
            repositoryId,
            invalidations: ["status", "history", "management"],
        });
        await delay(100);
        expect(events).toEqual([]);
    });

    it("[성공]을 받고, 로그인하고, 잠금 및 관련 없는 Git을 통해 데이터를 무시하고", async () => {
        const { gitDirectory, repositoryId, service, source } =
            await createFixture();
        const events: RepositoryChangedEvent[] = [];
        await service.watch(repositoryId, (event) => events.push(event));

        source.emit(join(gitDirectory, "objects", "ab", "object"));
        source.emit(join(gitDirectory, "logs", "HEAD"));
        source.emit(join(gitDirectory, "index.lock"));
        source.emit(join(gitDirectory, "refs", "heads", "feature.lock"));
        source.emit(join(gitDirectory, "COMMIT_EDITMSG"));

        await delay(120);
        expect(events).toEqual([]);
    });

    it("[실패] unwatch는 보는 이들 사이에서 휴가를 보내고 싶어하는 이벤트를 분리함", async () => {
        const { root, repositoryId, service, source } = await createFixture();
        const events: RepositoryChangedEvent[] = [];
        await service.watch(repositoryId, (event) => events.push(event));

        source.emit(join(root, "tracked.txt"));
        await service.unwatch(repositoryId);
        source.emit(join(root, "tracked.txt"));

        await delay(120);
        expect(events).toEqual([]);
    });

    it("[성공] dispose는 현재 이벤트를 분리하고 멱등성을 갖고 있음", async () => {
        const { root, repositoryId, service, source } = await createFixture();
        const events: RepositoryChangedEvent[] = [];
        await service.watch(repositoryId, (event) => events.push(event));

        await service.dispose();
        await service.dispose();
        source.emit(join(root, "tracked.txt"));

        await delay(120);
        expect(events).toEqual([]);
    });

    it("[실패] 표준 시계에만 표시되어 있으며 테두리 링크 또는 순회 이스케이프를 가지고 있음", async () => {
        const { root, repositoryId, service, source } = await createFixture();
        const events: RepositoryChangedEvent[] = [];
        const outside = join(root, "..", "outside.txt");
        await writeFile(outside, "secret\n", "utf8");
        await symlink(outside, join(root, "linked.txt"));
        await service.watch(repositoryId, (event) => events.push(event));

        source.emit(outside);
        source.emit(`${root}/../outside.txt`);

        await delay(120);
        expect(source.roots).toEqual([root]);
        expect(events).toEqual([]);
    });

    it("[실패] 연결되지 않은 연결 트리 및 스위치에 데이터 표시를 표시함", async () => {
        const { root, registry, service, source } = await createFixture();
        const linkedPath = join(root, "..", "linked-worktree");
        git(root, "worktree", "add", "-b", "feature", linkedPath);
        const linked = await registry.open(linkedPath);
        const events: RepositoryChangedEvent[] = [];
        await service.watch(linked.id, (event) => events.push(event));

        source.emit(join(linked.commonDirectory, "config"));

        expect(source.roots).toEqual([linked.path, linked.commonDirectory]);
        await expect(nextEvent(events)).resolves.toEqual({
            repositoryId: linked.id,
            invalidations: ["management"],
        });
    });

    it("[성공] 연결된 다른 작업 트리밍 데이터를 변경하여 관리를 초기화함", async () => {
        const { root, registry, service, source } = await createFixture();
        const linkedPath = join(root, "..", "linked-worktree");
        git(root, "worktree", "add", "-b", "feature", linkedPath);
        const linked = await registry.open(linkedPath);
        const events: RepositoryChangedEvent[] = [];
        await service.watch(linked.id, (event) => events.push(event));

        source.emit(
            join(linked.commonDirectory, "worktrees", "another", "HEAD"),
        );

        await expect(nextEvent(events)).resolves.toEqual({
            repositoryId: linked.id,
            invalidations: ["management"],
        });
    });
});
