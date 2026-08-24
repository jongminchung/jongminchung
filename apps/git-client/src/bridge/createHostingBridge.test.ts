import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RepositoryAccessPolicy,
  SafeModeViolationError,
} from "../domain/repositoryAccess";
import type { DesktopApi } from "../shared/contracts/desktop-api";
import { ElectronHostingBridge } from "./ElectronHostingBridge";

const platformMock = vi.hoisted(() => ({ electronApi: vi.fn() }));

vi.mock("../platform/electron", () => ({
  electronApi: platformMock.electronApi,
}));

import { createHostingBridge } from "./createHostingBridge";

describe("createHostingBridge", () => {
  beforeEach(() => platformMock.electronApi.mockReset());

  it("[성공] 사전 로드 API가 있는 경우 전자 다리를 선택함", () => {
    const hosting = {
      saveAccount: vi.fn(),
      beginOAuth: vi.fn(),
      awaitOAuth: vi.fn(),
      cancelOAuth: vi.fn(),
      restoreAccounts: vi.fn(),
      deleteAccount: vi.fn(),
      execute: vi.fn(),
    };
    platformMock.electronApi.mockReturnValue({
      hosting,
    } as unknown as DesktopApi);

    expect(createHostingBridge()).toBeInstanceOf(ElectronHostingBridge);
  });

  it("[실패] Electron 외부에서 실패하면 반사되는 모습", () => {
    platformMock.electronApi.mockReturnValue(null);

    expect(() => createHostingBridge()).toThrow(
      "Git Client requires the Electron desktop bridge.",
    );
  });

  it("[실패] 활성 프로젝트가 권한 모드에 있는 동안만 사전 로드 방법을 호출하지 마십시오", async () => {
    const hosting = {
      saveAccount: vi.fn(),
      beginOAuth: vi.fn(),
      awaitOAuth: vi.fn(),
      cancelOAuth: vi.fn(),
      restoreAccounts: vi.fn(),
      deleteAccount: vi.fn(),
      execute: vi.fn(),
    };
    platformMock.electronApi.mockReturnValue({
      hosting,
    } as unknown as DesktopApi);
    const access = RepositoryAccessPolicy.create();
    access.open("repository-a", "/tmp/project-a", "safe");
    access.activate("repository-a");
    const bridge = createHostingBridge(access);

    await expect(bridge.restoreAccounts([])).rejects.toBeInstanceOf(
      SafeModeViolationError,
    );
    await expect(
      bridge.beginOAuth("gitHub", "https://github.com", ""),
    ).rejects.toBeInstanceOf(SafeModeViolationError);
    await expect(
      bridge.awaitOAuth("91af28cc-4493-4ceb-b405-84878dd5dbe8"),
    ).rejects.toBeInstanceOf(SafeModeViolationError);
    await expect(
      bridge.cancelOAuth("91af28cc-4493-4ceb-b405-84878dd5dbe8"),
    ).rejects.toBeInstanceOf(SafeModeViolationError);
    await expect(bridge.deleteAccount("account-a")).rejects.toBeInstanceOf(
      SafeModeViolationError,
    );
    expect(hosting.restoreAccounts).not.toHaveBeenCalled();
    expect(hosting.beginOAuth).not.toHaveBeenCalled();
    expect(hosting.awaitOAuth).not.toHaveBeenCalled();
    expect(hosting.cancelOAuth).not.toHaveBeenCalled();
    expect(hosting.deleteAccount).not.toHaveBeenCalled();
  });
});
