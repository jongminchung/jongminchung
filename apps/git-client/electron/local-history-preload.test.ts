import { describe, expect, it, vi } from "vitest";
import {
  DESKTOP_TRPC_CHANNELS,
  DESKTOP_TRPC_PROTOCOL_VERSION,
} from "../src/shared/contracts/desktop-trpc-wire";
import type { LocalHistoryApi } from "../src/shared/contracts/local-history-ipc";

const electronMock = vi.hoisted(() => ({
  exposed: new Map<string, unknown>(),
  invoke: vi.fn(),
}));

vi.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: (key: string, value: unknown) =>
      electronMock.exposed.set(key, value),
  },
  ipcRenderer: {
    invoke: electronMock.invoke,
  },
}));

await import("./local-history-preload");

describe("의상 사전 로드", () => {
  it("[성공] 승리 채널을 통해 6개의 위치에 있는 파티에만 참여함", async () => {
    const api = electronMock.exposed.get(
      "gitClientLocalHistory",
    ) as LocalHistoryApi;
    expect([...electronMock.exposed.keys()]).toEqual(["gitClientLocalHistory"]);
    expect(Object.keys(api).sort()).toEqual(
      [
        "createPatch",
        "listActivities",
        "putLabel",
        "readActivity",
        "readDiff",
        "revert",
      ].sort(),
    );

    electronMock.invoke.mockResolvedValue({
      ok: true,
      data: {
        operation: "readLocalHistoryDiff",
        value: "diff",
      },
    });
    await expect(
      api.readDiff(
        "02fc7f7c-3f66-514b-9470-451a776cfcc7",
        "388ac97b-6f01-4e10-8149-78ec15412d18",
        "README.md",
      ),
    ).resolves.toBe("diff");
    expect(electronMock.invoke).toHaveBeenCalledWith(
      DESKTOP_TRPC_CHANNELS.localHistory,
      {
        version: DESKTOP_TRPC_PROTOCOL_VERSION,
        type: "mutation",
        path: "localHistory.repositoryService",
        input: {
          operation: "readLocalHistoryDiff",
          repositoryId: "02fc7f7c-3f66-514b-9470-451a776cfcc7",
          activityId: "388ac97b-6f01-4e10-8149-78ec15412d18",
          path: "README.md",
        },
      },
    );
  });
});
