import type { BrowserWindow } from "electron";
import type { MainDesktopTrpcRouter } from "../../src/shared/contracts/desktop-trpc";
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
import type { DesktopStreamPublisher } from "./desktop-stream-hub";
import type { DesktopTrpcHost } from "./desktop-trpc-host";
import type { TerminalUtilityClient } from "./terminal-utility-client";

interface TerminalHandlerDependencies {
  readonly router: DesktopTrpcHost<MainDesktopTrpcRouter>;
  readonly stream: DesktopStreamPublisher;
  readonly window: BrowserWindow;
  readonly terminalUtility: TerminalUtilityClient;
  readonly repositoryPaths: ReadonlyMap<string, string>;
}

export function registerTerminalHandlers({
  router,
  stream,
  window,
  terminalUtility,
  repositoryPaths,
}: TerminalHandlerDependencies): () => void {
  const terminalRepositories = new Map<string, string>();
  const unsubscribeDisconnect =
    stream.onDisconnect?.(() => {
      for (const terminalId of terminalRepositories.keys()) {
        void terminalUtility.close({ terminalId }).catch(() => undefined);
      }
      terminalRepositories.clear();
    }) ?? (() => undefined);
  router.handle("terminal", "create", async (_event, raw) => {
    const request = TerminalCreateRequestSchema.parse(raw);
    const cwd = repositoryPaths.get(request.repositoryId);
    if (cwd === undefined)
      throw new Error("Repository is not open for terminal access");
    const result = await terminalUtility.create(
      { ...request, cwd },
      (terminalEvent) => {
        if (window.isDestroyed() || window.webContents.isDestroyed()) return;
        stream.publish({
          kind: "terminal.event",
          event: TerminalEventEnvelopeSchema.parse(terminalEvent),
        });
      },
    );
    const parsed = TerminalCreateResultSchema.parse(result);
    terminalRepositories.set(parsed.terminalId, request.repositoryId);
    return parsed;
  });
  router.handle("terminal", "listLaunchTargets", async (_event, raw) => {
    TerminalListLaunchTargetsRequestSchema.parse(raw);
    return TerminalLaunchTargetsSchema.parse(
      await terminalUtility.listLaunchTargets(),
    );
  });
  router.handle("terminal", "write", async (_event, raw): Promise<void> => {
    await terminalUtility.write(TerminalWriteRequestSchema.parse(raw));
  });
  router.handle("terminal", "resize", async (_event, raw): Promise<void> => {
    await terminalUtility.resize(TerminalResizeRequestSchema.parse(raw));
  });
  router.handle("terminal", "close", async (_event, raw): Promise<void> => {
    const request = TerminalCloseRequestSchema.parse(raw);
    try {
      await terminalUtility.close(request);
    } finally {
      terminalRepositories.delete(request.terminalId);
    }
  });
  router.handle(
    "terminal",
    "closeRepository",
    async (_event, raw): Promise<void> => {
      const request = TerminalCloseRepositoryRequestSchema.parse(raw);
      try {
        await terminalUtility.closeRepository(request);
      } finally {
        for (const [terminalId, repositoryId] of terminalRepositories) {
          if (repositoryId === request.repositoryId)
            terminalRepositories.delete(terminalId);
        }
      }
    },
  );
  return unsubscribeDisconnect;
}
