import type { DesktopApi } from "../../src/shared/contracts/desktop-api";
import {
    type TerminalClientEvent,
    TerminalCloseRepositoryRequestSchema,
    TerminalCloseRequestSchema,
    TerminalCreateRequestSchema,
    TerminalEventEnvelopeSchema,
    type TerminalEventListener,
    TerminalListLaunchTargetsRequestSchema,
    type TerminalRequestId,
    TerminalResizeRequestSchema,
    TerminalWriteRequestSchema,
} from "../../src/shared/contracts/terminal";
import { desktopStream } from "./desktop-stream-client";
import { desktopTrpc } from "./main-trpc-client";

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
            return desktopTrpc.terminal.listLaunchTargets.query(request);
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
                const result =
                    await desktopTrpc.terminal.create.mutate(request);
                if (result.requestId !== request.requestId) {
                    throw new Error(
                        "Terminal create result did not match its request",
                    );
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
            await desktopTrpc.terminal.write.mutate(request);
        },
        async resize(terminalId, cols, rows): Promise<void> {
            const request = TerminalResizeRequestSchema.parse({
                terminalId,
                cols,
                rows,
            });
            await desktopTrpc.terminal.resize.mutate(request);
        },
        async close(terminalId): Promise<void> {
            const request = TerminalCloseRequestSchema.parse({ terminalId });
            try {
                await desktopTrpc.terminal.close.mutate(request);
            } finally {
                const requestId = terminalRequests.get(request.terminalId);
                terminalRequests.delete(request.terminalId);
                if (requestId !== undefined)
                    terminalListeners.delete(requestId);
            }
        },
        async closeRepository(repositoryId): Promise<void> {
            const request = TerminalCloseRepositoryRequestSchema.parse({
                repositoryId,
            });
            await desktopTrpc.terminal.closeRepository.mutate(request);
        },
    };
}
