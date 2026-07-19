import { describe, expect, it, vi } from "vitest";
import { RefreshCoordinator } from "./RefreshCoordinator";

describe("RefreshCoordinator", () => {
    it("merges queued invalidations and serializes a follow-up refresh", async () => {
        let finishFirst: (() => void) | undefined;
        const refresh = vi.fn(
            (
                _repositoryId: string,
                _invalidations: readonly string[],
            ): Promise<void> => {
                if (refresh.mock.calls.length === 1) {
                    return new Promise((resolve) => {
                        finishFirst = resolve;
                    });
                }
                return Promise.resolve();
            },
        );
        const coordinator = RefreshCoordinator.of(refresh);

        coordinator.invalidate("repo", ["status"]);
        coordinator.invalidate("repo", ["status", "history"]);
        await Promise.resolve();
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(refresh).toHaveBeenNthCalledWith(1, "repo", [
            "status",
            "history",
        ]);

        coordinator.invalidate("repo", ["stash"]);
        finishFirst?.();
        await coordinator.flush("repo");

        expect(refresh).toHaveBeenCalledTimes(2);
        expect(refresh).toHaveBeenNthCalledWith(2, "repo", ["stash"]);
    });

    it("defers inactive repository work until it is resumed", async () => {
        const refresh = vi.fn(async (): Promise<void> => undefined);
        const coordinator = RefreshCoordinator.of(refresh);

        coordinator.defer("repo", ["status"]);
        coordinator.defer("repo", ["history", "status"]);
        await Promise.resolve();
        expect(refresh).not.toHaveBeenCalled();

        expect(await coordinator.resume("repo")).toBe(true);
        expect(refresh).toHaveBeenCalledOnce();
        expect(refresh).toHaveBeenCalledWith("repo", ["status", "history"]);
        expect(await coordinator.resume("repo")).toBe(false);
    });
});
