import { ipcRenderer } from "electron";
import { IPC_CHANNELS } from "../../src/shared/contracts/ipc";
import type { DesktopApi } from "../../src/shared/contracts/ipc";
import {
  type TerminalClientEvent,
  TerminalCloseRepositoryRequestSchema,
  TerminalCloseRequestSchema,
  TerminalCreateRequestSchema,
  TerminalCreateResultSchema,
  TerminalEventEnvelopeSchema,
  type TerminalEventListener,
  TerminalLaunchTargetsSchema,
  TerminalListLaunchTargetsRequestSchema,
  type TerminalRequestId,
  TerminalResizeRequestSchema,
  TerminalWriteRequestSchema,
} from "../../src/shared/contracts/terminal";

const terminalListeners = new Map<TerminalRequestId, TerminalEventListener>();

const terminalRequests = new Map<string, TerminalRequestId>();

function terminalClientEvent(
  event: ReturnType<typeof TerminalEventEnvelopeSchema.parse>,
): TerminalClientEvent {
  switch (event.kind) {
    case "output":
      return {
        kind: "output",
        sequence: event.sequence,
        data: [...event.data],
      };
    case "exited":
      return {
        kind: "exited",
        exitCode: event.exitCode,
        signal: event.signal,
      };
    case "failed":
      return { kind: "failed", message: event.message };
  }
}

ipcRenderer.on(IPC_CHANNELS.terminalEvent, (_event, raw: unknown): void => {
  const event = TerminalEventEnvelopeSchema.parse(raw);
  const listener = terminalListeners.get(event.requestId);
  if (listener === undefined) return;
  try {
    listener(terminalClientEvent(event));
  } catch {
    // Renderer callbacks cannot interrupt terminal lifecycle cleanup or future events.
  }
  if (event.kind === "exited" || event.kind === "failed") {
    terminalListeners.delete(event.requestId);
    terminalRequests.delete(event.terminalId);
  }
});

export function createTerminalApi(): DesktopApi["terminal"] {
  return {
    async listLaunchTargets() {
      const request = TerminalListLaunchTargetsRequestSchema.parse({});
      const raw: unknown = await ipcRenderer.invoke(
        IPC_CHANNELS.terminalListLaunchTargets,
        request,
      );
      return TerminalLaunchTargetsSchema.parse(raw);
    },
    async create(repositoryId, cols, rows, target, listener) {
      const request = TerminalCreateRequestSchema.parse({
        requestId: globalThis.crypto.randomUUID(),
        repositoryId,
        cols,
        rows,
        target,
      });
      terminalListeners.set(request.requestId, listener);
      try {
        const raw: unknown = await ipcRenderer.invoke(IPC_CHANNELS.terminalCreate, request);
        const result = TerminalCreateResultSchema.parse(raw);
        if (result.requestId !== request.requestId) {
          throw new Error("Terminal create result did not match its request");
        }
        if (terminalListeners.has(request.requestId)) {
          terminalRequests.set(result.terminalId, request.requestId);
        }
        return result.terminalId;
      } catch (error) {
        terminalListeners.delete(request.requestId);
        throw error;
      }
    },
    async write(terminalId, data): Promise<void> {
      const request = TerminalWriteRequestSchema.parse({
        terminalId,
        data,
      });
      await ipcRenderer.invoke(IPC_CHANNELS.terminalWrite, request);
    },
    async resize(terminalId, cols, rows): Promise<void> {
      const request = TerminalResizeRequestSchema.parse({
        terminalId,
        cols,
        rows,
      });
      await ipcRenderer.invoke(IPC_CHANNELS.terminalResize, request);
    },
    async close(terminalId): Promise<void> {
      const request = TerminalCloseRequestSchema.parse({ terminalId });
      try {
        await ipcRenderer.invoke(IPC_CHANNELS.terminalClose, request);
      } finally {
        const requestId = terminalRequests.get(request.terminalId);
        terminalRequests.delete(request.terminalId);
        if (requestId !== undefined) terminalListeners.delete(requestId);
      }
    },
    async closeRepository(repositoryId): Promise<void> {
      const request = TerminalCloseRepositoryRequestSchema.parse({
        repositoryId,
      });
      await ipcRenderer.invoke(IPC_CHANNELS.terminalCloseRepository, request);
    },
  };
}
