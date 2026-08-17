import { describe, expect, it, vi } from "vitest";
import { RepositoryWatchSession } from "./RepositoryWatchSession";

describe("현재 WatchSession", () => {
    it("[성공] 처음 구독 실패 후 재시도", async () => {
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

    it("[성공] 여러분이 구독자를 분리하고 움직이려고 노력할 것임", async () => {
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
