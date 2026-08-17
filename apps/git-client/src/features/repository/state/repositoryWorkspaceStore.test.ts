import { describe, expect, it } from "vitest";
import { createRepositoryWorkspaceStore } from "./repositoryWorkspaceStore";

function createStore(repositoryId: string) {
    return createRepositoryWorkspaceStore({
        repositoryId,
        repositoryName: repositoryId,
        selectedRef: "refs/heads/main",
        electronRuntime: false,
    });
}

describe("작업공간스토어", () => {
    it("[성공] 리포지토리 간 상태와 독립을 분리함", () => {
        const first = createStore("repository-1");
        const second = createStore("repository-2");

        first.getState().setProjectFiles(["src/first.ts"]);
        first.getState().setSelectedOids(["abc"]);

        expect(first.getState().projectFiles).toEqual(["src/first.ts"]);
        expect(second.getState().projectFiles).toEqual([]);
        expect(second.getState().selectedOids).toEqual([]);
        expect(first.getState().generation).not.toBe(
            second.getState().generation,
        );
    });

    it("[실패] 배낭이 소형화된 후에는 쓸모없게 되었습니다", () => {
        const store = createStore("repository-1");
        const token = store.getState().createRequestToken();

        expect(store.getState().isRequestCurrent(token)).toBe(true);
        store.getState().invalidateScope();
        expect(store.getState().isRequestCurrent(token)).toBe(false);

        const other = createStore("repository-1");
        expect(other.getState().isRequestCurrent(token)).toBe(false);
    });

    it("[성공] 범위가 현재인 동안에만 파티를 커밋함", async () => {
        const store = createStore("repository-1");
        let resolveTask: ((value: string) => void) | undefined;
        const task = new Promise<string>((resolve) => {
            resolveTask = resolve;
        });
        const committed: string[] = [];

        const result = store.getState().runRepositoryTask(
            () => task,
            (value) => committed.push(value),
        );
        store.getState().invalidateScope();
        resolveTask?.("stale");

        await expect(result).resolves.toBe(false);
        expect(committed).toEqual([]);
    });

    it("[실패] 오래된 오류를 범하지 않고 계속해서 실패를 해결함", async () => {
        const current = createStore("repository-1");
        const failures: string[] = [];

        await expect(
            current.getState().runRepositoryTask(
                async () => Promise.reject(new Error("failed")),
                () => undefined,
                (error) =>
                    failures.push(
                        error instanceof Error ? error.message : String(error),
                    ),
            ),
        ).resolves.toBe(true);
        expect(failures).toEqual(["failed"]);

        const stale = createStore("repository-2");
        let rejectTask: ((error: Error) => void) | undefined;
        const task = new Promise<never>((_resolve, reject) => {
            rejectTask = reject;
        });
        const staleResult = stale.getState().runRepositoryTask(
            () => task,
            () => undefined,
            () => failures.push("stale"),
        );
        stale.getState().invalidateScope();
        rejectTask?.(new Error("stale failure"));

        await expect(staleResult).resolves.toBe(false);
        expect(failures).toEqual(["failed"]);
    });
});
