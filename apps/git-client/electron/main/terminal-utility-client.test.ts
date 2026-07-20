import { describe, expect, it } from "vitest";
import type { TerminalEventEnvelope } from "../../src/shared/contracts/terminal";
import {
  MainToTerminalUtilityMessageSchema,
  TERMINAL_UTILITY_PROTOCOL_VERSION,
  type MainToTerminalUtilityMessage,
} from "../../src/shared/contracts/terminal-utility-process";
import {
  TerminalUtilityClient,
  type TerminalUtilityProcessTransport,
} from "./terminal-utility-client";

const INSTANCE_ID = "b33e3adc-6a18-4c8e-b60d-b3619d72e28f";
const REQUEST_ID = "388ac97b-6f01-4e10-8149-78ec15412d18";
const REPOSITORY_ID = "02fc7f7c-3f66-514b-9470-451a776cfcc7";
const TERMINAL_ID = "f6478d5c-5aa0-4d4a-b646-cb950b0ca555";

class FakeTerminalUtilityTransport implements TerminalUtilityProcessTransport {
  readonly posted: unknown[] = [];
  readonly messageListeners = new Set<(message: unknown) => void>();
  readonly exitListeners = new Set<(exitCode: number) => void>();
  readonly errorListeners = new Set<(message: string) => void>();
  killCount = 0;

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  subscribeMessage(listener: (message: unknown) => void): () => void {
    this.messageListeners.add(listener);
    return () => this.messageListeners.delete(listener);
  }

  subscribeExit(listener: (exitCode: number) => void): () => void {
    this.exitListeners.add(listener);
    return () => this.exitListeners.delete(listener);
  }

  subscribeError(listener: (message: string) => void): () => void {
    this.errorListeners.add(listener);
    return () => this.errorListeners.delete(listener);
  }

  kill(): boolean {
    this.killCount += 1;
    return true;
  }

  emitMessage(message: unknown): void {
    for (const listener of this.messageListeners) listener(message);
  }
}

function lastMessage(transport: FakeTerminalUtilityTransport): MainToTerminalUtilityMessage {
  return MainToTerminalUtilityMessageSchema.parse(transport.posted.at(-1));
}

async function connectClient(): Promise<{
  readonly client: TerminalUtilityClient;
  readonly transport: FakeTerminalUtilityTransport;
}> {
  const transport = new FakeTerminalUtilityTransport();
  const connecting = TerminalUtilityClient.connect(transport, { handshakeTimeoutMs: 1_000 });
  transport.emitMessage({
    kind: "ready",
    protocolVersion: TERMINAL_UTILITY_PROTOCOL_VERSION,
    instanceId: INSTANCE_ID,
  });
  const handshake = lastMessage(transport);
  if (handshake.kind !== "handshake") throw new Error("Expected handshake request");
  transport.emitMessage({
    kind: "handshakeAck",
    correlationId: handshake.correlationId,
    protocolVersion: TERMINAL_UTILITY_PROTOCOL_VERSION,
    instanceId: INSTANCE_ID,
  });
  return { client: await connecting, transport };
}

describe("TerminalUtilityClient", () => {
  it("handshakes, creates a session, and forwards ordered output even before create resolves", async () => {
    const { client, transport } = await connectClient();
    const events: TerminalEventEnvelope[] = [];
    const creating = client.create(
      {
        requestId: REQUEST_ID,
        repositoryId: REPOSITORY_ID,
        cwd: "/tmp/repository",
        cols: 100,
        rows: 28,
      },
      (event) => events.push(event),
    );
    const create = lastMessage(transport);
    if (create.kind !== "create") throw new Error("Expected create request");
    const output: TerminalEventEnvelope = {
      kind: "output",
      requestId: REQUEST_ID,
      terminalId: TERMINAL_ID,
      sequence: 0,
      data: [36, 32],
    };
    transport.emitMessage({ kind: "terminalEvent", event: output });
    transport.emitMessage({
      kind: "createResult",
      correlationId: create.correlationId,
      result: { requestId: REQUEST_ID, terminalId: TERMINAL_ID },
    });

    await expect(creating).resolves.toEqual({ requestId: REQUEST_ID, terminalId: TERMINAL_ID });
    expect(events).toEqual([output]);
    expect(client.state).toBe("ready");
  });

  it("rejects an out-of-order PTY event and tears down the compromised utility", async () => {
    const { client, transport } = await connectClient();
    const creating = client.create(
      {
        requestId: REQUEST_ID,
        repositoryId: REPOSITORY_ID,
        cwd: "/tmp/repository",
        cols: 80,
        rows: 24,
      },
      () => undefined,
    );
    const create = lastMessage(transport);
    if (create.kind !== "create") throw new Error("Expected create request");
    transport.emitMessage({
      kind: "terminalEvent",
      event: {
        kind: "output",
        requestId: REQUEST_ID,
        terminalId: TERMINAL_ID,
        sequence: 1,
        data: [120],
      },
    });

    await expect(creating).rejects.toMatchObject({ code: "protocolViolation" });
    expect(client.state).toBe("crashed");
    expect(transport.killCount).toBe(1);
  });

  it("validates terminal controls and disposes all sessions with the utility", async () => {
    const { client, transport } = await connectClient();

    const listing = client.listLaunchTargets();
    const list = lastMessage(transport);
    if (list.kind !== "listLaunchTargets") throw new Error("Expected target list request");
    transport.emitMessage({
      kind: "listLaunchTargetsResult",
      correlationId: list.correlationId,
      targets: {
        shells: [{ kind: "shell", id: "zsh", displayName: "Zsh" }],
        agents: [{ kind: "agent", id: "codex", displayName: "Codex" }],
      },
    });
    await expect(listing).resolves.toEqual({
      shells: [{ kind: "shell", id: "zsh", displayName: "Zsh" }],
      agents: [{ kind: "agent", id: "codex", displayName: "Codex" }],
    });

    const writing = client.write({ terminalId: TERMINAL_ID, data: "pwd\r" });
    const write = lastMessage(transport);
    if (write.kind !== "write") throw new Error("Expected write request");
    transport.emitMessage({ kind: "writeResult", correlationId: write.correlationId });
    await expect(writing).resolves.toBeUndefined();

    const resizing = client.resize({ terminalId: TERMINAL_ID, cols: 120, rows: 40 });
    const resize = lastMessage(transport);
    if (resize.kind !== "resize") throw new Error("Expected resize request");
    transport.emitMessage({ kind: "resizeResult", correlationId: resize.correlationId });
    await expect(resizing).resolves.toBeUndefined();

    const closing = client.close({ terminalId: TERMINAL_ID });
    const close = lastMessage(transport);
    if (close.kind !== "close") throw new Error("Expected close request");
    transport.emitMessage({ kind: "closeResult", correlationId: close.correlationId });
    await expect(closing).resolves.toBeUndefined();

    const closingRepository = client.closeRepository({ repositoryId: REPOSITORY_ID });
    const closeRepository = lastMessage(transport);
    if (closeRepository.kind !== "closeRepository") {
      throw new Error("Expected close repository request");
    }
    transport.emitMessage({
      kind: "closeRepositoryResult",
      correlationId: closeRepository.correlationId,
      closed: 0,
    });
    await expect(closingRepository).resolves.toBe(0);

    const disposing = client.dispose();
    const dispose = lastMessage(transport);
    if (dispose.kind !== "dispose") throw new Error("Expected dispose request");
    transport.emitMessage({ kind: "disposeResult", correlationId: dispose.correlationId });
    await expect(disposing).resolves.toBeUndefined();
    expect(client.state).toBe("disposed");
    expect(transport.killCount).toBe(1);
  });
});
