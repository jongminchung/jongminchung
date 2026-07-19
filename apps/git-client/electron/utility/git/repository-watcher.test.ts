import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { RepositoryChangedEvent } from "../../../src/generated";
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

describe("RepositoryWatcherService", () => {
    it("cleans up an initial subscription failure so a later watch can succeed", async () => {
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

    it("reconnects after a runtime error and retries a failed reconnect with bounded backoff", async () => {
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

    it("emits a status invalidation when the opened worktree changes", async () => {
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

    it("invalidates status and history when HEAD changes", async () => {
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

    it("invalidates status when the Git index changes", async () => {
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

    it("invalidates history when a ref changes", async () => {
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

    it("invalidates status, history, and stash state when refs/stash changes", async () => {
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

    it("invalidates repository management when Git config changes", async () => {
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

    it("invalidates status and operation state when merge metadata changes", async () => {
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

    it("debounces a burst into one canonically ordered invalidation event", async () => {
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

    it("ignores object, log, lock, and unrelated Git metadata noise", async () => {
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

    it("unwatch cancels a pending debounce and detaches future events", async () => {
        const { root, repositoryId, service, source } = await createFixture();
        const events: RepositoryChangedEvent[] = [];
        await service.watch(repositoryId, (event) => events.push(event));

        source.emit(join(root, "tracked.txt"));
        await service.unwatch(repositoryId);
        source.emit(join(root, "tracked.txt"));

        await delay(120);
        expect(events).toEqual([]);
    });

    it("dispose detaches repository events and is idempotent", async () => {
        const { root, repositoryId, service, source } = await createFixture();
        const events: RepositoryChangedEvent[] = [];
        await service.watch(repositoryId, (event) => events.push(event));

        await service.dispose();
        await service.dispose();
        source.emit(join(root, "tracked.txt"));

        await delay(120);
        expect(events).toEqual([]);
    });

    it("watches only canonical repository roots and rejects symlink or traversal escapes", async () => {
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

    it("watches canonical linked-worktree and common metadata roots without duplication", async () => {
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

    it("invalidates management for another linked worktree metadata change", async () => {
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
