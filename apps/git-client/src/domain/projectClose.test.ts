import { describe, expect, it, vi } from "vitest";
import { closeProjectResources } from "./projectClose";

describe("닫기프로젝트자원", () => {
    it("[실패] 하나의 기본이 정리되는 경우에도 모든 것을 정리함", async () => {
        const unwatchRepository = vi.fn(async (repositoryId: string) => {
            if (repositoryId === "first") throw new Error("watcher stopped");
        });
        const closeRepositoryTerminals = vi.fn(async () => undefined);
        const forgetRepository = vi.fn();

        await closeProjectResources(["first", "second", "first"], {
            unwatchRepository,
            closeRepositoryTerminals,
            forgetRepository,
        });

        expect(unwatchRepository.mock.calls).toEqual([["first"], ["second"]]);
        expect(closeRepositoryTerminals.mock.calls).toEqual([
            ["first"],
            ["second"],
        ]);
        expect(forgetRepository.mock.calls).toEqual([["first"], ["second"]]);
    });
});
