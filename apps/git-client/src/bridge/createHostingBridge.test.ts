import { beforeEach, describe, expect, it, vi } from "vitest";
import { RepositoryAccessPolicy, SafeModeViolationError } from "../domain/repositoryAccess";
import type { DesktopApi } from "../shared/contracts/ipc";
import { ElectronHostingBridge } from "./ElectronHostingBridge";

const platformMock = vi.hoisted(() => ({ electronApi: vi.fn() }));

vi.mock("../platform/electron", () => ({
  electronApi: platformMock.electronApi,
}));

import { createHostingBridge } from "./createHostingBridge";

describe("createHostingBridge", () => {
  beforeEach(() => platformMock.electronApi.mockReset());

  it("selects the Electron bridge when the preload API is present", () => {
    const hosting = {
      saveAccount: vi.fn(),
      restoreAccounts: vi.fn(),
      deleteAccount: vi.fn(),
      execute: vi.fn(),
    };
    platformMock.electronApi.mockReturnValue({
      hosting,
    } as unknown as DesktopApi);

    expect(createHostingBridge()).toBeInstanceOf(ElectronHostingBridge);
  });

  it("fails closed outside Electron", () => {
    platformMock.electronApi.mockReturnValue(null);

    expect(() => createHostingBridge()).toThrow("Git Client requires the Electron desktop bridge.");
  });

  it("does not invoke any hosting preload method while the active project is in safe mode", async () => {
    const hosting = {
      saveAccount: vi.fn(),
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

    await expect(bridge.restoreAccounts([])).rejects.toBeInstanceOf(SafeModeViolationError);
    await expect(bridge.deleteAccount("account-a")).rejects.toBeInstanceOf(SafeModeViolationError);
    expect(hosting.restoreAccounts).not.toHaveBeenCalled();
    expect(hosting.deleteAccount).not.toHaveBeenCalled();
  });
});
