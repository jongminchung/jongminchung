import { describe, expect, it, vi } from "vitest";
import { closeProjectResources } from "./projectClose";

describe("closeProjectResources", () => {
  it("cleans every root even when one native cleanup rejects", async () => {
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
    expect(closeRepositoryTerminals.mock.calls).toEqual([["first"], ["second"]]);
    expect(forgetRepository.mock.calls).toEqual([["first"], ["second"]]);
  });
});
