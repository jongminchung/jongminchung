import { describe, expect, it } from "vitest";
import { closeLogTabState } from "./useRepositoryTabCoordinator";

describe("대신에 전환하세요", () => {
  it("[성공] 장점 활성 탭을 마지막으로 첫 번째 검사로 돌아갑니다", () => {
    expect(
      closeLogTabState({
        activeInspectorKey: undefined,
        activeLogTabId: "log-1",
        fallbackInspectorKey: "file:README.md",
        logTabIds: ["log-1"],
        tabId: "log-1",
      }),
    ).toEqual({
      activeLogTabId: "log-1",
      activateInspectorKey: "file:README.md",
      focusValue: "inspector:file:README.md",
      logOpen: false,
      logTabIds: ["log-1"],
    });
  });

  it("[성공] 검사하는 동안 교체 계약을 유지함", () => {
    expect(
      closeLogTabState({
        activeInspectorKey: undefined,
        activeLogTabId: "log-1",
        fallbackInspectorKey: undefined,
        logTabIds: ["log-1"],
        tabId: "log-1",
      }),
    ).toMatchObject({
      activateInspectorKey: null,
      focusValue: undefined,
      logOpen: false,
    });
  });

  it("[성공] 활성 탭이 될 때 힐을 받을 때 탭을 선택함", () => {
    expect(
      closeLogTabState({
        activeInspectorKey: undefined,
        activeLogTabId: "log-2",
        fallbackInspectorKey: undefined,
        logTabIds: ["log-1", "log-2", "log-3"],
        tabId: "log-2",
      }),
    ).toEqual({
      activeLogTabId: "log-3",
      activateInspectorKey: null,
      focusValue: "log:log-3",
      logOpen: true,
      logTabIds: ["log-1", "log-3"],
    });
  });
});
