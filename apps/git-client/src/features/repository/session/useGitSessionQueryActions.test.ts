import { describe, expect, it, vi } from "vitest";
import type { GitBridge } from "../../../application/git-session/ports/GitBridge";
import type { GitSessionQueryPort } from "../../../application/git-session/ports/GitSessionBackend";
import { createGitSessionRuntime } from "../../../application/git-session/state/GitSessionRuntime";
import type {
    GitRequest,
    RepositorySnapshot,
} from "../../../shared/contracts/model/index";
import { runProjectTextSearch } from "./useGitSessionQueryActions";

describe("project text search session", () => {
    it("cancels without starting a live query when clear or unmount sends an empty query", async () => {
        const runtime = createGitSessionRuntime("repository-1");
        runtime.activeSearchRequest = "request-1";
        const cancel = vi.fn(async () => undefined);
        const search = vi.fn(async () => []);
        const runRequest = vi.fn(async (_request: GitRequest) => "");

        await expect(
            runProjectTextSearch(
                "",
                { matchCase: false, words: false, regex: false },
                {
                    activeSnapshot: () =>
                        ({ id: "repository-1" }) as RepositorySnapshot,
                    gitBridge: { cancel } as unknown as GitBridge,
                    queryPort: { search } as unknown as GitSessionQueryPort,
                    runRequest,
                    runtime,
                },
            ),
        ).resolves.toEqual([]);

        expect(cancel).toHaveBeenCalledWith("request-1");
        expect(runtime.activeSearchRequest).toBeNull();
        expect(search).not.toHaveBeenCalled();
        expect(runRequest).not.toHaveBeenCalled();
    });
});
