import { watch as watchPath } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";
import type {
    RepositoryChangedEvent,
    RepositoryInvalidation,
} from "../../../src/generated";
import type {
    RepositoryId,
    RepositoryRecord,
} from "../../../src/shared/contracts/git-utility";
import type { RepositoryRegistry } from "./repository-registry";

export interface RepositoryWatcherOptions {
    readonly debounceMs?: number;
    readonly reconnectInitialDelayMs?: number;
    readonly reconnectMaxDelayMs?: number;
    readonly source?: RepositoryWatchSource;
}

export type RepositoryChangedListener = (event: RepositoryChangedEvent) => void;

const INVALIDATION_ORDER = [
    "status",
    "history",
    "stash",
    "operation",
    "management",
] as const satisfies readonly RepositoryInvalidation[];

export interface RepositoryWatchSubscription {
    close(): void;
}

export interface RepositoryWatchSource {
    subscribe(
        root: string,
        listener: (path: string) => void,
        onError?: (error: Error) => void,
    ): RepositoryWatchSubscription;
}

class NodeRepositoryWatchSource implements RepositoryWatchSource {
    subscribe(
        root: string,
        listener: (path: string) => void,
        onError: (error: Error) => void = () => undefined,
    ): RepositoryWatchSubscription {
        const watcher = watchPath(
            root,
            {
                encoding: "utf8",
                persistent: false,
                recursive: true,
            },
            (_eventType, filename) => {
                listener(filename === null ? root : join(root, filename));
            },
        );
        watcher.on("error", onError);
        return { close: () => watcher.close() };
    }
}

interface WatchSession {
    readonly record: RepositoryRecord;
    readonly listener: RepositoryChangedListener;
    readonly invalidations: Set<RepositoryInvalidation>;
    subscriptions: readonly RepositoryWatchSubscription[];
    timer: ReturnType<typeof setTimeout> | null;
    reconnectTimer: ReturnType<typeof setTimeout> | null;
    reconnectAttempt: number;
}

function isInside(root: string, candidate: string): boolean {
    const path = relative(root, candidate);
    return (
        path === "" ||
        (!isAbsolute(path) && path !== ".." && !path.startsWith(`..${sep}`))
    );
}

function isOperationMetadata(path: string): boolean {
    if (
        [
            "MERGE_HEAD",
            "CHERRY_PICK_HEAD",
            "REVERT_HEAD",
            "BISECT_LOG",
            "AUTO_MERGE",
        ].includes(path)
    ) {
        return true;
    }
    return ["rebase-merge", "rebase-apply", "sequencer"].some(
        (root) => path === root || path.startsWith(`${root}${sep}`),
    );
}

function classifyRepositoryPath(
    record: RepositoryRecord,
    path: string,
): readonly RepositoryInvalidation[] {
    const metadata = isInside(record.gitDirectory, path)
        ? { path: relative(record.gitDirectory, path), currentWorktree: true }
        : isInside(record.commonDirectory, path)
          ? {
                path: relative(record.commonDirectory, path),
                currentWorktree: false,
            }
          : null;
    if (metadata !== null) {
        const metadataPath = metadata.path;
        if (
            metadataPath.endsWith(".lock") ||
            metadataPath === "objects" ||
            metadataPath.startsWith(`objects${sep}`) ||
            metadataPath === "logs" ||
            metadataPath.startsWith(`logs${sep}`)
        ) {
            return [];
        }
        if (metadataPath === "index") return ["status"];
        if (metadataPath === join("refs", "stash"))
            return ["status", "history", "stash"];
        if (metadataPath === "HEAD") return ["status", "history"];
        if (metadataPath === "refs" || metadataPath.startsWith(`refs${sep}`))
            return ["history"];
        if (isOperationMetadata(metadataPath)) return ["status", "operation"];
        if (metadataPath === "config" || metadataPath === "config.worktree")
            return ["management"];
        if (
            !metadata.currentWorktree &&
            (metadataPath === "worktrees" ||
                metadataPath.startsWith(`worktrees${sep}`))
        ) {
            return ["management"];
        }
        return [];
    }
    return isInside(record.path, path) ? ["status"] : [];
}

function canonicalWatchRoots(record: RepositoryRecord): readonly string[] {
    const roots: string[] = [];
    for (const candidate of [
        record.path,
        record.commonDirectory,
        record.gitDirectory,
    ]) {
        if (roots.some((root) => isInside(root, candidate))) continue;
        roots.push(candidate);
    }
    return roots;
}

export class RepositoryWatcherService {
    readonly #registry: RepositoryRegistry;
    readonly #debounceMs: number;
    readonly #reconnectInitialDelayMs: number;
    readonly #reconnectMaxDelayMs: number;
    readonly #source: RepositoryWatchSource;
    readonly #sessions = new Map<RepositoryId, WatchSession>();

    private constructor(
        registry: RepositoryRegistry,
        debounceMs: number,
        reconnectInitialDelayMs: number,
        reconnectMaxDelayMs: number,
        source: RepositoryWatchSource,
    ) {
        this.#registry = registry;
        this.#debounceMs = debounceMs;
        this.#reconnectInitialDelayMs = reconnectInitialDelayMs;
        this.#reconnectMaxDelayMs = reconnectMaxDelayMs;
        this.#source = source;
    }

    static of(
        registry: RepositoryRegistry,
        options: RepositoryWatcherOptions = {},
    ): RepositoryWatcherService {
        const debounceMs = options.debounceMs ?? 250;
        if (
            !Number.isSafeInteger(debounceMs) ||
            debounceMs < 1 ||
            debounceMs > 10_000
        ) {
            throw new Error(
                "Repository watcher debounce must be an integer from 1 to 10000 milliseconds",
            );
        }
        const reconnectInitialDelayMs = options.reconnectInitialDelayMs ?? 100;
        if (
            !Number.isSafeInteger(reconnectInitialDelayMs) ||
            reconnectInitialDelayMs < 1 ||
            reconnectInitialDelayMs > 10_000
        ) {
            throw new Error(
                "Repository watcher reconnect delay must be an integer from 1 to 10000 milliseconds",
            );
        }
        const reconnectMaxDelayMs = options.reconnectMaxDelayMs ?? 5_000;
        if (
            !Number.isSafeInteger(reconnectMaxDelayMs) ||
            reconnectMaxDelayMs < reconnectInitialDelayMs ||
            reconnectMaxDelayMs > 60_000
        ) {
            throw new Error(
                "Repository watcher maximum reconnect delay must be an integer from the initial delay to 60000 milliseconds",
            );
        }
        return new RepositoryWatcherService(
            registry,
            debounceMs,
            reconnectInitialDelayMs,
            reconnectMaxDelayMs,
            options.source ?? new NodeRepositoryWatchSource(),
        );
    }

    async watch(
        repositoryId: RepositoryId,
        listener: RepositoryChangedListener,
    ): Promise<void> {
        await this.unwatch(repositoryId);
        const record = this.#registry.get(repositoryId);
        const session: WatchSession = {
            record,
            listener,
            invalidations: new Set<RepositoryInvalidation>(),
            subscriptions: [],
            timer: null,
            reconnectTimer: null,
            reconnectAttempt: 0,
        };
        this.#sessions.set(repositoryId, session);
        try {
            session.subscriptions = this.#subscribe(repositoryId, session);
        } catch (error) {
            if (this.#sessions.get(repositoryId) === session)
                this.#sessions.delete(repositoryId);
            this.#closeSubscriptions(session);
            throw error;
        }
    }

    unwatch(repositoryId: RepositoryId): Promise<void> {
        const session = this.#sessions.get(repositoryId);
        if (session === undefined) return Promise.resolve();
        this.#sessions.delete(repositoryId);
        if (session.timer !== null) clearTimeout(session.timer);
        if (session.reconnectTimer !== null)
            clearTimeout(session.reconnectTimer);
        session.invalidations.clear();
        this.#closeSubscriptions(session);
        return Promise.resolve();
    }

    async dispose(): Promise<void> {
        await Promise.all(
            [...this.#sessions.keys()].map((repositoryId) =>
                this.unwatch(repositoryId),
            ),
        );
    }

    #subscribe(
        repositoryId: RepositoryId,
        session: WatchSession,
    ): readonly RepositoryWatchSubscription[] {
        const subscriptions: RepositoryWatchSubscription[] = [];
        try {
            for (const root of canonicalWatchRoots(session.record)) {
                subscriptions.push(
                    this.#source.subscribe(
                        root,
                        (path) => {
                            for (const invalidation of classifyRepositoryPath(
                                session.record,
                                path,
                            )) {
                                this.#invalidate(repositoryId, invalidation);
                            }
                        },
                        () =>
                            queueMicrotask(() =>
                                this.#handleRuntimeError(repositoryId, session),
                            ),
                    ),
                );
            }
            return subscriptions;
        } catch (error) {
            for (const subscription of subscriptions) subscription.close();
            throw error;
        }
    }

    #handleRuntimeError(
        repositoryId: RepositoryId,
        session: WatchSession,
    ): void {
        if (
            this.#sessions.get(repositoryId) !== session ||
            session.reconnectTimer !== null
        )
            return;
        if (session.timer !== null) {
            clearTimeout(session.timer);
            session.timer = null;
        }
        session.invalidations.clear();
        this.#closeSubscriptions(session);
        this.#scheduleReconnect(repositoryId, session);
    }

    #scheduleReconnect(
        repositoryId: RepositoryId,
        session: WatchSession,
    ): void {
        if (
            this.#sessions.get(repositoryId) !== session ||
            session.reconnectTimer !== null
        )
            return;
        const delay = Math.min(
            this.#reconnectMaxDelayMs,
            this.#reconnectInitialDelayMs *
                2 ** Math.min(session.reconnectAttempt, 16),
        );
        session.reconnectAttempt += 1;
        session.reconnectTimer = setTimeout(() => {
            session.reconnectTimer = null;
            if (this.#sessions.get(repositoryId) !== session) return;
            try {
                session.subscriptions = this.#subscribe(repositoryId, session);
                session.reconnectAttempt = 0;
                for (const invalidation of INVALIDATION_ORDER) {
                    this.#invalidate(repositoryId, invalidation);
                }
            } catch {
                this.#scheduleReconnect(repositoryId, session);
            }
        }, delay);
        session.reconnectTimer.unref();
    }

    #closeSubscriptions(session: WatchSession): void {
        const subscriptions = session.subscriptions;
        session.subscriptions = [];
        for (const subscription of subscriptions) subscription.close();
    }

    #invalidate(
        repositoryId: RepositoryId,
        invalidation: RepositoryInvalidation,
    ): void {
        const session = this.#sessions.get(repositoryId);
        if (session === undefined) return;
        session.invalidations.add(invalidation);
        if (session.timer !== null) clearTimeout(session.timer);
        session.timer = setTimeout(() => {
            session.timer = null;
            if (
                this.#sessions.get(repositoryId) !== session ||
                session.invalidations.size === 0
            )
                return;
            const invalidations = INVALIDATION_ORDER.filter((invalidation) =>
                session.invalidations.has(invalidation),
            );
            session.invalidations.clear();
            try {
                session.listener({ repositoryId, invalidations });
            } catch {
                // A renderer listener cannot interrupt watcher cleanup or later repository events.
            }
        }, this.#debounceMs);
        session.timer.unref();
    }
}
