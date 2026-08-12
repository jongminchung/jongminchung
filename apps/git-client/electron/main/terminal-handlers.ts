import type { BrowserWindow } from "electron";
import { RPC_PROCEDURES } from "../../src/shared/contracts/desktop-rpc";
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
import type { DesktopRpcRouter } from "./desktop-rpc-router";
import type { DesktopStreamPublisher } from "./desktop-stream-hub";
import { assertTrustedSender } from "./ipc-security";
import type { TerminalUtilityClient } from "./terminal-utility-client";

interface TerminalHandlerDependencies {
  readonly router: DesktopRpcRouter;
  readonly stream: DesktopStreamPublisher;
  readonly window: BrowserWindow;
  readonly terminalUtility: TerminalUtilityClient;
  readonly repositoryPaths: ReadonlyMap<string, string>;
  readonly assertRepositoryCapability: (repositoryId: string, capability: "terminal") => void;
  readonly assertActiveCapability: (capability: "terminal") => void;
}

export function registerTerminalHandlers({
  router,
  stream,
  window,
  terminalUtility,
  repositoryPaths,
  assertRepositoryCapability,
  assertActiveCapability,
}: TerminalHandlerDependencies): () => void {
  const terminalRepositories = new Map<string, string>();
  const unsubscribeDisconnect =
    stream.onDisconnect?.(() => {
      for (const terminalId of terminalRepositories.keys()) {
        void terminalUtility.close({ terminalId }).catch(() => undefined);
      }
      terminalRepositories.clear();
    }) ?? (() => undefined);
  router.handle(RPC_PROCEDURES.terminalCreate, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    const request = TerminalCreateRequestSchema.parse(raw);
    assertRepositoryCapability(request.repositoryId, "terminal");
    const cwd = repositoryPaths.get(request.repositoryId);
    if (cwd === undefined) throw new Error("Repository is not open for terminal access");
    const result = await terminalUtility.create({ ...request, cwd }, (terminalEvent) => {
      if (window.isDestroyed() || window.webContents.isDestroyed()) return;
      stream.publish({
        kind: "terminal.event",
        event: TerminalEventEnvelopeSchema.parse(terminalEvent),
      });
    });
    const parsed = TerminalCreateResultSchema.parse(result);
    terminalRepositories.set(parsed.terminalId, request.repositoryId);
    return parsed;
  });
  router.handle(RPC_PROCEDURES.terminalListLaunchTargets, async (event, raw: unknown) => {
    assertTrustedSender(event, window);
    TerminalListLaunchTargetsRequestSchema.parse(raw);
    assertActiveCapability("terminal");
    return TerminalLaunchTargetsSchema.parse(await terminalUtility.listLaunchTargets());
  });
  router.handle(RPC_PROCEDURES.terminalWrite, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    await terminalUtility.write(TerminalWriteRequestSchema.parse(raw));
  });
  router.handle(RPC_PROCEDURES.terminalResize, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    await terminalUtility.resize(TerminalResizeRequestSchema.parse(raw));
  });
  router.handle(RPC_PROCEDURES.terminalClose, async (event, raw: unknown): Promise<void> => {
    assertTrustedSender(event, window);
    const request = TerminalCloseRequestSchema.parse(raw);
    try {
      await terminalUtility.close(request);
    } finally {
      terminalRepositories.delete(request.terminalId);
    }
  });
  router.handle(
    RPC_PROCEDURES.terminalCloseRepository,
    async (event, raw: unknown): Promise<void> => {
      assertTrustedSender(event, window);
      const request = TerminalCloseRepositoryRequestSchema.parse(raw);
      try {
        await terminalUtility.closeRepository(request);
      } finally {
        for (const [terminalId, repositoryId] of terminalRepositories) {
          if (repositoryId === request.repositoryId) terminalRepositories.delete(terminalId);
        }
      }
    },
  );
  return unsubscribeDisconnect;
}
