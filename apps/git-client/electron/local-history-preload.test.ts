import { describe, expect, it, vi } from "vitest";
import { IPC_CHANNELS } from "../src/shared/contracts/ipc";
import type { LocalHistoryApi } from "../src/shared/contracts/local-history-ipc";

const electronMock = vi.hoisted(() => ({
  exposed: new Map<string, unknown>(),
  invoke: vi.fn(),
}));

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: (key: string, value: unknown) => electronMock.exposed.set(key, value),
  },
  ipcRenderer: {
    invoke: electronMock.invoke,
  },
}));

await import("./local-history-preload");

describe("Local History preload", () => {
  it("exposes only the six Local History operations through its dedicated channel", async () => {
    const api = electronMock.exposed.get("gitClientLocalHistory") as LocalHistoryApi;
    expect([...electronMock.exposed.keys()]).toEqual(["gitClientLocalHistory"]);
    expect(Object.keys(api).sort()).toEqual(
      ["createPatch", "listActivities", "putLabel", "readActivity", "readDiff", "revert"].sort(),
    );

    electronMock.invoke.mockResolvedValue({
      operation: "readLocalHistoryDiff",
      value: "diff",
    });
    await expect(
      api.readDiff(
        "02fc7f7c-3f66-514b-9470-451a776cfcc7",
        "388ac97b-6f01-4e10-8149-78ec15412d18",
        "README.md",
      ),
    ).resolves.toBe("diff");
    expect(electronMock.invoke).toHaveBeenCalledWith(IPC_CHANNELS.localHistoryRepositoryService, {
      operation: "readLocalHistoryDiff",
      repositoryId: "02fc7f7c-3f66-514b-9470-451a776cfcc7",
      activityId: "388ac97b-6f01-4e10-8149-78ec15412d18",
      path: "README.md",
    });
  });
});
