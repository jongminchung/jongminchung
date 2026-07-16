import type { GitEvent } from "../generated";
import type { ConsoleChunk, ConsoleEntry } from "./types";

type Listener = () => void;

const EMPTY_ENTRIES: readonly ConsoleEntry[] = [];
const MAX_ENTRIES = 500;

export class GitConsoleStore {
    readonly #entries = new Map<string, readonly ConsoleEntry[]>();
    readonly #listeners = new Map<string, Set<Listener>>();

    private constructor() {}

    static create(): GitConsoleStore {
        return new GitConsoleStore();
    }

    accept(repositoryId: string, event: GitEvent): void {
        if (event.kind === "started") {
            const entries = [
                ...this.getSnapshot(repositoryId),
                {
                    id: event.requestId,
                    requestId: event.requestId,
                    command: event.displayCommand,
                    startedAt: event.startedAtMs,
                    status: "running" as const,
                    chunks: [],
                },
            ].slice(-MAX_ENTRIES);
            this.publish(repositoryId, entries);
            return;
        }
        const entries = this.getSnapshot(repositoryId);
        const next = entries.map((entry): ConsoleEntry => {
            if (entry.requestId !== event.requestId) return entry;
            if (event.kind === "output") {
                const chunk: ConsoleChunk = {
                    sequence: event.sequence,
                    stream: event.stream,
                    data: event.data,
                };
                return { ...entry, chunks: [...entry.chunks, chunk] };
            }
            if (event.kind === "completed") {
                return {
                    ...entry,
                    status: "success",
                    duration: event.durationMs,
                    exitCode: event.exitCode,
                };
            }
            if (event.kind === "cancelled") {
                return {
                    ...entry,
                    status: "cancelled",
                    duration: event.durationMs,
                };
            }
            return {
                ...entry,
                status: "failure",
                duration: event.durationMs,
                exitCode: event.exitCode ?? undefined,
                chunks: [
                    ...entry.chunks,
                    {
                        sequence: Number.MAX_SAFE_INTEGER,
                        stream: "stderr",
                        data: `${event.message}\n`,
                    },
                ],
            };
        });
        if (next.some((entry, index) => entry !== entries[index]))
            this.publish(repositoryId, next);
    }

    getSnapshot(repositoryId: string): readonly ConsoleEntry[] {
        return this.#entries.get(repositoryId) ?? EMPTY_ENTRIES;
    }

    subscribe(repositoryId: string, listener: Listener): () => void {
        const listeners =
            this.#listeners.get(repositoryId) ?? new Set<Listener>();
        this.#listeners.set(repositoryId, listeners);
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
            if (listeners.size === 0) this.#listeners.delete(repositoryId);
        };
    }

    clear(repositoryId: string): void {
        if (!this.#entries.has(repositoryId)) return;
        this.publish(repositoryId, EMPTY_ENTRIES);
    }

    remove(repositoryId: string): void {
        this.#entries.delete(repositoryId);
        this.#listeners.delete(repositoryId);
    }

    private publish(
        repositoryId: string,
        entries: readonly ConsoleEntry[],
    ): void {
        this.#entries.set(repositoryId, entries);
        for (const listener of this.#listeners.get(repositoryId) ?? [])
            listener();
    }
}

export const gitConsoleStore = GitConsoleStore.create();
