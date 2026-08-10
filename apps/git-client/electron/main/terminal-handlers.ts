import { ipcMain } from "electron";
import type { BrowserWindow } from "electron";
import { IPC_CHANNELS } from "../../src/shared/contracts/ipc";
import {
  TerminalCloseRepositoryRequestSchema,
  TerminalCloseRequestSchema,
  TerminalCreateRequestSchema,
  TerminalCreateResultSchema,
  TerminalEventEnvelopeSchema,
  TerminalLaunchTargetsSchema,
  TerminalListLaunchTargetsRequestSchema,
  TerminalResizeRequestSchema,
  TerminalWriteRequestSchema,
} from "../../src/shared/contracts/terminal";
import { assertTrustedSender } from "./ipc-security";
import type { TerminalUtilityClient } from "./terminal-utility-client";

interface TerminalHandlerDependencies {
  readonly window: BrowserWindow;
  readonly terminalUtility: TerminalUtilityClient;
  readonly repositoryPaths: ReadonlyMap<string, string>;
  readonly assertRepositoryCapability: (repositoryId: string, capability: "terminal") => void;
  readonly assertActiveCapability: (capability: "terminal") => void;
}

export function registerTerminalHandlers({
  window,
  terminalUtility,
  repositoryPaths,
  assertRepositoryCapability,
  assertActiveCapability,
}: TerminalHandlerDependencies): void {
  ipcMain.handle(IPC_CHANNELS.terminalCreate, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    const request = TerminalCreateRequestSchema.parse(raw);
    assertRepositoryCapability(request.repositoryId, "terminal");
    const cwd = repositoryPaths.get(request.repositoryId);
    if (cwd === undefined) throw new Error("Repository is not open for terminal access");
    const result = await terminalUtility.create({ ...request, cwd }, (terminalEvent) => {
      if (window.isDestroyed() || window.webContents.isDestroyed()) return;
      window.webContents.send(
        IPC_CHANNELS.terminalEvent,
        TerminalEventEnvelopeSchema.parse(terminalEvent),
      );
    });
    return TerminalCreateResultSchema.parse(result);
  });
  ipcMain.handle(IPC_CHANNELS.terminalListLaunchTargets, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    TerminalListLaunchTargetsRequestSchema.parse(raw);
    assertActiveCapability("terminal");
    return TerminalLaunchTargetsSchema.parse(await terminalUtility.listLaunchTargets());
  });
  ipcMain.handle(IPC_CHANNELS.terminalWrite, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    await terminalUtility.write(TerminalWriteRequestSchema.parse(raw));
  });
  ipcMain.handle(IPC_CHANNELS.terminalResize, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    await terminalUtility.resize(TerminalResizeRequestSchema.parse(raw));
  });
  ipcMain.handle(IPC_CHANNELS.terminalClose, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    await terminalUtility.close(TerminalCloseRequestSchema.parse(raw));
  });
  ipcMain.handle(
    IPC_CHANNELS.terminalCloseRepository,
    async (event, raw: unknown): Promise<void> => {
      assertTrustedSender(event, window);
      await terminalUtility.closeRepository(TerminalCloseRepositoryRequestSchema.parse(raw));
    },
  );
}
