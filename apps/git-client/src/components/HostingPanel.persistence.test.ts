import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DesktopApi } from "../shared/contracts/ipc";

const platformMock = vi.hoisted(() => ({
  electronApi: vi.fn(),
}));

vi.mock("../platform/electron", () => platformMock);

import {
  loadHostingAccounts,
  loadViewedFiles,
  openHostingUrl,
  persistHostingAccounts,
  persistViewedFiles,
  viewedFilesKey,
} from "./hosting-persistence";

const ACCOUNT = Object.freeze({
  id: "account-1",
  provider: "gitHub" as const,
  baseUrl: "https://github.com",
  login: "octocat",
});

function electronApi(
  get: ReturnType<typeof vi.fn>,
  set: ReturnType<typeof vi.fn>,
  openExternal: ReturnType<typeof vi.fn>,
): DesktopApi {
  return {
    settings: { get, set, delete: vi.fn() },
    shell: { openExternal },
  } as unknown as DesktopApi;
}

describe("HostingPanel native persistence", () => {
  beforeEach(() => {
    platformMock.electronApi.mockReset();
  });

  it("uses Electron settings, validates account metadata, and never persists a token", async () => {
    const get = vi.fn(async (key: string): Promise<unknown> => {
      if (key === "hostingAccounts") {
        return [ACCOUNT, { ...ACCOUNT, provider: "unknown" }, "not-an-account"];
      }
      return ["z.ts", 42, "a.ts"];
    });
    const set = vi.fn(async () => undefined);
    const openExternal = vi.fn(async () => undefined);
    platformMock.electronApi.mockReturnValue(electronApi(get, set, openExternal));

    await expect(loadHostingAccounts()).resolves.toEqual([ACCOUNT]);
    await persistHostingAccounts([ACCOUNT]);
    await expect(loadViewedFiles("account-1", "owner/repo", 7)).resolves.toEqual(
      new Set(["z.ts", "a.ts"]),
    );
    await persistViewedFiles("account-1", "owner/repo", 7, new Set(["z.ts", "a.ts"]));
    await openHostingUrl("https://github.com/owner/repo/pull/7");

    expect(set).toHaveBeenNthCalledWith(1, "hostingAccounts", [ACCOUNT]);
    expect(JSON.stringify(set.mock.calls)).not.toContain("token");
    expect(set).toHaveBeenNthCalledWith(2, viewedFilesKey("account-1", "owner/repo", 7), [
      "a.ts",
      "z.ts",
    ]);
    expect(openExternal).toHaveBeenCalledWith("https://github.com/owner/repo/pull/7");
  });

  it("fails closed when no Electron settings boundary exists", async () => {
    platformMock.electronApi.mockReturnValue(null);

    await expect(loadHostingAccounts()).rejects.toThrow("Electron settings are unavailable");
  });
});
