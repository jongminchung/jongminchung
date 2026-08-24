import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  LocalHistoryDesktopTrpcRouter,
  MainDesktopTrpcRouter,
} from "../../src/shared/contracts/desktop-trpc";
import {
  DESKTOP_TRPC_CHANNELS,
  DESKTOP_TRPC_PROTOCOL_VERSION,
} from "../../src/shared/contracts/desktop-trpc-wire";

const electronMock = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("electron", () => ({
  ipcRenderer: { invoke: electronMock.invoke },
}));

import { createDesktopTrpcClient } from "./desktop-trpc-client";

describe("전자 tRPC 링크", () => {
  beforeEach(() => electronMock.invoke.mockReset());

  it("[성공] 첫 번째 노선 구간에서 5개 채널 중 하나를 선택함", async () => {
    electronMock.invoke.mockResolvedValue({ ok: true, data: undefined });
    const main = createDesktopTrpcClient<MainDesktopTrpcRouter>();
    const localHistory =
      createDesktopTrpcClient<LocalHistoryDesktopTrpcRouter>();

    await main.platform.runtimeInfo.query();
    await main.git.cancelQuery.mutate({
      requestId: "388ac97b-6f01-4e10-8149-78ec15412d18",
    });
    await main.terminal.listLaunchTargets.query({});
    await main.hosting.deleteAccount.mutate({ accountId: "account-1" });
    await localHistory.localHistory.repositoryService.mutate({
      operation: "readLocalHistoryDiff",
      repositoryId: "02fc7f7c-3f66-514b-9470-451a776cfcc7",
      activityId: "388ac97b-6f01-4e10-8149-78ec15412d18",
      path: "README.md",
    });

    expect(electronMock.invoke.mock.calls.map(([channel]) => channel)).toEqual([
      DESKTOP_TRPC_CHANNELS.platform,
      DESKTOP_TRPC_CHANNELS.git,
      DESKTOP_TRPC_CHANNELS.terminal,
      DESKTOP_TRPC_CHANNELS.hosting,
      DESKTOP_TRPC_CHANNELS.localHistory,
    ]);
    expect(electronMock.invoke).toHaveBeenNthCalledWith(
      1,
      DESKTOP_TRPC_CHANNELS.platform,
      {
        version: DESKTOP_TRPC_PROTOCOL_VERSION,
        type: "query",
        path: "platform.runtimeInfo",
        input: undefined,
      },
    );
    expect(electronMock.invoke).toHaveBeenNthCalledWith(
      2,
      DESKTOP_TRPC_CHANNELS.git,
      {
        version: DESKTOP_TRPC_PROTOCOL_VERSION,
        type: "mutation",
        path: "git.cancelQuery",
        input: { requestId: "388ac97b-6f01-4e10-8149-78ec15412d18" },
      },
    );
  });

  it("[실패] 삭제된 믿어지지 않는 변형하고 잘못된 응답을 했습니다", async () => {
    const client = createDesktopTrpcClient<MainDesktopTrpcRouter>();
    electronMock.invoke.mockResolvedValueOnce({
      ok: false,
      error: { code: "FORBIDDEN", message: "Repository access denied" },
    });

    await expect(client.platform.runtimeInfo.query()).rejects.toThrow(
      "Repository access denied",
    );

    electronMock.invoke.mockResolvedValueOnce({
      ok: true,
      data: null,
      stack: "secret",
    });
    await expect(client.platform.runtimeInfo.query()).rejects.toThrow();
  });
});
