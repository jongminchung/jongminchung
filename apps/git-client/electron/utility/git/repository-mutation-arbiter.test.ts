import { describe, expect, it } from "vitest";
import {
    RepositoryMutationArbiter,
    RepositoryMutationCancelledError,
} from "./repository-mutation-arbiter";

interface Deferred {
    readonly promise: Promise<void>;
    readonly resolve: () => void;
}

function deferred(): Deferred {
    let resolvePromise: (() => void) | null = null;
    const promise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
    });
    return {
        promise,
        resolve: () => {
            if (resolvePromise === null)
                throw new Error("Deferred promise is unavailable");
            resolvePromise();
        },
    };
}

describe("표면돌연변이중재자", () => {
    it("[성공] 클럽에 편지를 쓰고 직렬화함", async () => {
        const arbiter = new RepositoryMutationArbiter();
        const firstStarted = deferred();
        const releaseFirst = deferred();
        const order: string[] = [];

        const first = arbiter.run(
            ["repository"],
            new AbortController().signal,
            async () => {
                order.push("first:start");
                firstStarted.resolve();
                await releaseFirst.promise;
                order.push("first:end");
            },
        );
        await firstStarted.promise;
        const second = arbiter.run(
            ["repository"],
            new AbortController().signal,
            async () => {
                order.push("second");
            },
        );
        await Promise.resolve();

        expect(order).toEqual(["first:start"]);
        releaseFirst.resolve();
        await Promise.all([first, second]);
        expect(order).toEqual(["first:start", "first:end", "second"]);
    });

    it("[성공] 다른 곳에 대한 뉘우침을 느낄 수 있음", async () => {
        const arbiter = new RepositoryMutationArbiter();
        const release = deferred();
        const started: string[] = [];

        const first = arbiter.run(
            ["first"],
            new AbortController().signal,
            async () => {
                started.push("first");
                await release.promise;
            },
        );
        const second = arbiter.run(
            ["second"],
            new AbortController().signal,
            async () => {
                started.push("second");
                await release.promise;
            },
        );
        await Promise.resolve();

        expect(started).toEqual(["first", "second"]);
        release.resolve();
        await Promise.all([first, second]);
    });

    it("[실패] 변형을 실행하지 않고 취소된 웨이터를 제거함", async () => {
        const arbiter = new RepositoryMutationArbiter();
        const firstStarted = deferred();
        const releaseFirst = deferred();
        const first = arbiter.run(
            ["repository"],
            new AbortController().signal,
            async () => {
                firstStarted.resolve();
                await releaseFirst.promise;
            },
        );
        await firstStarted.promise;

        const cancellation = new AbortController();
        let secondStarted = false;
        const second = arbiter.run(
            ["repository"],
            cancellation.signal,
            async () => {
                secondStarted = true;
            },
        );
        cancellation.abort("repositoryClosed");

        await expect(second).rejects.toMatchObject({
            name: "RepositoryMutationCancelledError",
            reason: "repositoryClosed",
        } satisfies Partial<RepositoryMutationCancelledError>);
        expect(secondStarted).toBe(false);

        releaseFirst.resolve();
        await first;
        await expect(
            arbiter.run(
                ["repository"],
                new AbortController().signal,
                async () => "available",
            ),
        ).resolves.toBe("available");
    });

    it("[성공] 잠금 시간 교착 상태를 잠시 기다리기 전에 다수의 소유권을 대신함", async () => {
        const arbiter = new RepositoryMutationArbiter();
        const firstStarted = deferred();
        const releaseFirst = deferred();
        const first = arbiter.run(
            ["a"],
            new AbortController().signal,
            async () => {
                firstStarted.resolve();
                await releaseFirst.promise;
            },
        );
        await firstStarted.promise;

        let multiStarted = false;
        const multi = arbiter.run(
            ["b", "a"],
            new AbortController().signal,
            async () => {
                multiStarted = true;
            },
        );
        let repositoryBStarted = false;
        const repositoryB = arbiter.run(
            ["b"],
            new AbortController().signal,
            async () => {
                repositoryBStarted = true;
            },
        );
        await Promise.resolve();

        expect(repositoryBStarted).toBe(true);
        expect(multiStarted).toBe(false);
        await repositoryB;
        releaseFirst.resolve();
        await Promise.all([first, multi]);
        expect(multiStarted).toBe(true);
    });
});
