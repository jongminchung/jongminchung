import { beforeEach, describe, expect, it, vi } from "vitest";
import { IPC_CHANNELS } from "../../src/shared/contracts/ipc";

type InvokeHandler = (event: unknown, raw: unknown) => unknown;

const electronMock = vi.hoisted(() => ({
  handlers: new Map<string, InvokeHandler>(),
  clipboardWriteText: vi.fn(),
  fromWebContents: vi.fn(() => null as unknown),
  openExternal: vi.fn(),
  openPath: vi.fn(),
}));

vi.mock("electron", () => ({
  BrowserWindow: { fromWebContents: electronMock.fromWebContents },
  clipboard: { writeText: electronMock.clipboardWriteText },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
  },
  ipcMain: {
    handle: (channel: string, handler: InvokeHandler): void => {
      electronMock.handlers.set(channel, handler);
    },
    removeHandler: (channel: string): void => {
      electronMock.handlers.delete(channel);
    },
  },
  shell: {
    openExternal: electronMock.openExternal,
    openPath: electronMock.openPath,
  },
}));

import { registerPlatformHandlers, unregisterPlatformHandlers } from "./platform-handlers";

function handler(channel: string): InvokeHandler {
  const registered = electronMock.handlers.get(channel);
  if (registered === undefined) throw new Error(`No handler registered for ${channel}`);
  return registered;
}

describe("platform hosting IPC handlers", () => {
  const account = Object.freeze({
    id: "account-1",
    provider: "gitHub" as const,
    baseUrl: "https://github.com",
    login: "octocat",
  });

  beforeEach(() => electronMock.handlers.clear());

  function setup() {
    const mainFrame = { url: "app://git-client/" };
    const webContents = {
      isDestroyed: () => false,
      mainFrame,
      send: vi.fn(),
    };
    const window = { isDestroyed: () => false, webContents };
    const hosting = {
      saveAccount: vi.fn(async () => account),
      restoreAccounts: vi.fn(),
      deleteAccount: vi.fn(async () => undefined),
      execute: vi.fn(async () => ({
        kind: "completed" as const,
        message: "done",
      })),
    };
    registerPlatformHandlers({
      window,
      settings: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
      menu: { sync: vi.fn() },
      gitUtility: {},
      terminalUtility: {},
      hosting,
      runtime: {
        kind: "electron",
        appVersion: "0.1.0",
        electronVersion: "43.3.0",
        platform: "darwin",
        architecture: "arm64",
        qaFixture: false,
      },
    } as unknown as Parameters<typeof registerPlatformHandlers>[0]);
    return {
      event: { sender: webContents, senderFrame: mainFrame },
      hosting,
      webContents,
    };
  }

  it("validates, delegates, and unregisters every hosting channel", async () => {
    const { event, hosting } = setup();
    const token = "ghp_super-secret-token";

    const saved = await handler(IPC_CHANNELS.hostingSaveAccount)(event, {
      provider: "gitHub",
      baseUrl: "https://github.com/",
      token,
    });
    expect(
      handler(IPC_CHANNELS.hostingRestoreAccounts)(event, {
        accounts: [account],
      }),
    ).toBeUndefined();
    await expect(
      handler(IPC_CHANNELS.hostingDeleteAccount)(event, {
        accountId: account.id,
      }),
    ).resolves.toBeUndefined();
    await expect(
      handler(IPC_CHANNELS.hostingExecute)(event, {
        accountId: account.id,
        request: {
          kind: "comment",
          project: "owner/repo",
          number: 7,
          body: "Looks good",
        },
      }),
    ).resolves.toEqual({ kind: "completed", message: "done" });

    expect(saved).toEqual(account);
    expect(JSON.stringify(saved)).not.toContain(token);
    expect(hosting.saveAccount).toHaveBeenCalledWith("gitHub", "https://github.com", token);
    expect(hosting.restoreAccounts).toHaveBeenCalledWith([account]);
    expect(hosting.deleteAccount).toHaveBeenCalledWith(account.id);

    unregisterPlatformHandlers();
    for (const channel of [
      IPC_CHANNELS.hostingSaveAccount,
      IPC_CHANNELS.hostingRestoreAccounts,
      IPC_CHANNELS.hostingDeleteAccount,
      IPC_CHANNELS.hostingExecute,
    ]) {
      expect(electronMock.handlers.has(channel)).toBe(false);
    }
  });

  it("rejects untrusted senders before delegation", async () => {
    const { event, hosting } = setup();
    const untrusted = { ...event, sender: {} };

    await expect(
      handler(IPC_CHANNELS.hostingDeleteAccount)(untrusted, {
        accountId: account.id,
      }),
    ).rejects.toThrow("IPC sender is not the main window");
    expect(hosting.deleteAccount).not.toHaveBeenCalled();
    unregisterPlatformHandlers();
  });

  it("redacts credentials and rejects response kinds that do not match requests", async () => {
    const { event, hosting } = setup();
    const token = "ghp_super-secret-token";
    hosting.saveAccount.mockRejectedValueOnce(
      new Error(`Authorization: Bearer ${token}; token=${token}`),
    );

    let saveError: unknown;
    try {
      await handler(IPC_CHANNELS.hostingSaveAccount)(event, {
        provider: "gitHub",
        baseUrl: "https://github.com",
        token,
      });
    } catch (error) {
      saveError = error;
    }
    expect(String(saveError)).toContain("[redacted]");
    expect(String(saveError)).not.toContain(token);

    hosting.execute.mockResolvedValueOnce({
      kind: "completed",
      message: "wrong kind",
    });
    await expect(
      handler(IPC_CHANNELS.hostingExecute)(event, {
        accountId: account.id,
        request: { kind: "files", project: "owner/repo", number: 7 },
      }),
    ).rejects.toThrow("Hosting response did not match its request");
    unregisterPlatformHandlers();
  });
});
