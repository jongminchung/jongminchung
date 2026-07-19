import { describe, expect, it, vi } from "vitest";
import { RepositoryWatchSession } from "./repository-watch-session";

describe("RepositoryWatchSession", () => {
    it("retries after an initial subscription failure", async () => {
        const session = new RepositoryWatchSession();
        const subscribe = vi
            .fn<() => Promise<void>>()
            .mockRejectedValueOnce(new Error("watch unavailable"))
            .mockResolvedValue(undefined);

        await expect(session.ensure("repository-1", subscribe)).rejects.toThrow(
            "watch unavailable",
        );
        expect(session.isWatched("repository-1")).toBe(false);

        await expect(
            session.ensure("repository-1", subscribe),
        ).resolves.toBeUndefined();
        expect(subscribe).toHaveBeenCalledTimes(2);
        expect(session.isWatched("repository-1")).toBe(true);
    });

    it("deduplicates concurrent subscriptions and forgets pending attempts", async () => {
        const session = new RepositoryWatchSession();
        let resolveSubscription: (() => void) | undefined;
        const subscribe = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    resolveSubscription = resolve;
                }),
        );

        const first = session.ensure("repository-1", subscribe);
        const second = session.ensure("repository-1", subscribe);
        await Promise.resolve();
        expect(subscribe).toHaveBeenCalledTimes(1);
        expect(session.trackedRepositoryIds()).toEqual(["repository-1"]);

        session.forget("repository-1");
        resolveSubscription?.();
        await Promise.all([first, second]);
        expect(session.isWatched("repository-1")).toBe(false);
        expect(session.trackedRepositoryIds()).toEqual([]);
    });
});
