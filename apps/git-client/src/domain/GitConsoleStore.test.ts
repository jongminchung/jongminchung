import { describe, expect, it, vi } from "vitest";
import { GitConsoleStore } from "./GitConsoleStore";

describe("GitConsoleStore", () => {
    it("publishes streamed command state only to the matching repository", () => {
        const store = GitConsoleStore.create();
        const repoListener = vi.fn();
        const otherListener = vi.fn();
        store.subscribe("repo", repoListener);
        store.subscribe("other", otherListener);

        store.accept("repo", {
            kind: "started",
            requestId: "request-1",
            displayCommand: "git status",
            startedAtMs: 10,
        });
        store.accept("repo", {
            kind: "output",
            requestId: "request-1",
            sequence: 0,
            stream: "stdout",
            data: "clean",
        });
        store.accept("repo", {
            kind: "completed",
            requestId: "request-1",
            exitCode: 0,
            durationMs: 12,
        });

        expect(store.getSnapshot("repo")).toEqual([
            {
                id: "request-1",
                requestId: "request-1",
                command: "git status",
                startedAt: 10,
                duration: 12,
                exitCode: 0,
                status: "success",
                chunks: [{ sequence: 0, stream: "stdout", data: "clean" }],
            },
        ]);
        expect(repoListener).toHaveBeenCalledTimes(3);
        expect(otherListener).not.toHaveBeenCalled();
    });
});
