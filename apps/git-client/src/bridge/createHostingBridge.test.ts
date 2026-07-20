import { beforeEach, describe, expect, it, vi } from "vitest";
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
});
