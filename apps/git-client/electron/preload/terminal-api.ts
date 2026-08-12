import type { DesktopApi } from "../../src/shared/contracts/desktop-api";
import { RPC_PROCEDURES } from "../../src/shared/contracts/desktop-rpc";
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
import { desktopStream } from "./desktop-stream-client";
import { invokeDesktopRpc } from "./rpc-client";

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

desktopStream.subscribe((envelope): void => {
  if (envelope.kind !== "terminal.event") return;
  const event = TerminalEventEnvelopeSchema.parse(envelope.event);
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
      const raw: unknown = await invokeDesktopRpc(
        RPC_PROCEDURES.terminalListLaunchTargets,
        request,
      );
      return TerminalLaunchTargetsSchema.parse(raw);
    },
    async create(repositoryId, cols, rows, target, listener) {
      await desktopStream.ready();
      const request = TerminalCreateRequestSchema.parse({
        requestId: globalThis.crypto.randomUUID(),
        repositoryId,
        cols,
        rows,
        target,
      });
      terminalListeners.set(request.requestId, listener);
      try {
        const raw: unknown = await invokeDesktopRpc(RPC_PROCEDURES.terminalCreate, request);
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
      await invokeDesktopRpc(RPC_PROCEDURES.terminalWrite, request);
    },
    async resize(terminalId, cols, rows): Promise<void> {
      const request = TerminalResizeRequestSchema.parse({
        terminalId,
        cols,
        rows,
      });
      await invokeDesktopRpc(RPC_PROCEDURES.terminalResize, request);
    },
    async close(terminalId): Promise<void> {
      const request = TerminalCloseRequestSchema.parse({ terminalId });
      try {
        await invokeDesktopRpc(RPC_PROCEDURES.terminalClose, request);
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
      await invokeDesktopRpc(RPC_PROCEDURES.terminalCloseRepository, request);
    },
  };
}
