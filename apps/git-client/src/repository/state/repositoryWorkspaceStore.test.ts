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

describe("RepositoryWorkspaceStore", () => {
    it("isolates state and generations between repositories", () => {
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

    it("rejects stale async tokens after the repository scope is invalidated", () => {
        const store = createStore("repository-1");
        const token = store.getState().createRequestToken();

        expect(store.getState().isRequestCurrent(token)).toBe(true);
        store.getState().invalidateScope();
        expect(store.getState().isRequestCurrent(token)).toBe(false);

        const other = createStore("repository-1");
        expect(other.getState().isRequestCurrent(token)).toBe(false);
    });

    it("commits repository tasks only while the scope is current", async () => {
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

    it("settles current task failures without committing stale errors", async () => {
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
