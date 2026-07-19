import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  TERMINAL_UTILITY_PROTOCOL_VERSION,
  TerminalUtilityToMainMessageSchema,
} from "../../../src/shared/contracts/terminal-utility-process";
import type {
  TerminalCreateResult,
  TerminalEventEnvelope,
} from "../../../src/shared/contracts/terminal";
import {
  TerminalUtilityProtocolServer,
  type TerminalUtilityServerPort,
  type TerminalUtilityServiceLike,
} from "./utility-server";

const REQUEST_ID = "388ac97b-6f01-4e10-8149-78ec15412d18";
const REPOSITORY_ID = "02fc7f7c-3f66-514b-9470-451a776cfcc7";
const TERMINAL_ID = "f6478d5c-5aa0-4d4a-b646-cb950b0ca555";

class FakeServerPort implements TerminalUtilityServerPort {
  readonly posted: unknown[] = [];
  readonly listeners = new Set<(message: unknown) => void>();

  postMessage(message: unknown): void {
    this.posted.push(message);
  }

  subscribe(listener: (message: unknown) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(message: unknown): void {
    for (const listener of this.listeners) listener(message);
  }
}

class FakeTerminalUtility implements TerminalUtilityServiceLike {
  disposeCount = 0;

  create(_request: unknown, listener: (event: TerminalEventEnvelope) => void): TerminalCreateResult {
    listener({
      kind: "output",
      requestId: REQUEST_ID,
      terminalId: TERMINAL_ID,
      sequence: 0,
      data: [36, 32],
    });
    return { requestId: REQUEST_ID, terminalId: TERMINAL_ID };
  }

  listLaunchTargets() {
    return { shells: [], agents: [] } as const;
  }

  write(): void {}
  resize(): void {}
  close(): void {}
  closeRepository(): number {
    return 1;
  }
  dispose(): void {
    this.disposeCount += 1;
  }
}

async function flushServer(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe("TerminalUtilityProtocolServer", () => {
  it("requires a handshake and validates every command and emitted event", async () => {
    const port = new FakeServerPort();
    const utility = new FakeTerminalUtility();
    let disposed = false;
    const server = new TerminalUtilityProtocolServer(port, utility, {
      onDispose: () => {
        disposed = true;
      },
    });
    server.start();
    const ready = TerminalUtilityToMainMessageSchema.parse(port.posted.at(-1));
    if (ready.kind !== "ready") throw new Error("Expected ready message");

    const handshakeId = randomUUID();
    port.emit({
      kind: "handshake",
      correlationId: handshakeId,
      protocolVersion: TERMINAL_UTILITY_PROTOCOL_VERSION,
      instanceId: ready.instanceId,
    });
    await flushServer();

    const createId = randomUUID();
    port.emit({
      kind: "create",
      correlationId: createId,
      request: {
        requestId: REQUEST_ID,
        repositoryId: REPOSITORY_ID,
        cwd: "/tmp/repository",
        cols: 100,
        rows: 28,
      },
    });
    await flushServer();

    const createMessages = port.posted
      .map((message) => TerminalUtilityToMainMessageSchema.parse(message))
      .filter(
        (message) =>
          message.kind === "terminalEvent" ||
          (message.kind === "createResult" && message.correlationId === createId),
      );
    expect(createMessages.map((message) => message.kind)).toEqual([
      "terminalEvent",
      "createResult",
    ]);

    const listId = randomUUID();
    port.emit({ kind: "listLaunchTargets", correlationId: listId });
    await flushServer();
    expect(TerminalUtilityToMainMessageSchema.parse(port.posted.at(-1))).toEqual({
      kind: "listLaunchTargetsResult",
      correlationId: listId,
      targets: { shells: [], agents: [] },
    });

    const closeRepositoryId = randomUUID();
    port.emit({
      kind: "closeRepository",
      correlationId: closeRepositoryId,
      request: { repositoryId: REPOSITORY_ID },
    });
    await flushServer();
    expect(TerminalUtilityToMainMessageSchema.parse(port.posted.at(-1))).toMatchObject({
      kind: "closeRepositoryResult",
      correlationId: closeRepositoryId,
      closed: 1,
    });

    const disposeId = randomUUID();
    port.emit({ kind: "dispose", correlationId: disposeId });
    await flushServer();
    expect(TerminalUtilityToMainMessageSchema.parse(port.posted.at(-1))).toMatchObject({
      kind: "disposeResult",
      correlationId: disposeId,
    });
    expect(utility.disposeCount).toBe(1);
    expect(disposed).toBe(true);
  });
});
