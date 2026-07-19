import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import type {
  TerminalCreateResult,
  TerminalEventEnvelope,
  TerminalLaunchTargets,
} from "../../../src/shared/contracts/terminal";
import {
  MainToTerminalUtilityMessageSchema,
  TERMINAL_UTILITY_PROTOCOL_VERSION,
  TerminalUtilityToMainMessageSchema,
  type MainToTerminalUtilityMessage,
  type TerminalUtilityErrorCode,
  type TerminalUtilityToMainMessage,
} from "../../../src/shared/contracts/terminal-utility-process";
import { TerminalUtilityError } from "./terminal-utility";

export interface TerminalUtilityServerPort {
  postMessage(message: unknown): void;
  subscribe(listener: (message: unknown) => void): () => void;
}

export interface TerminalUtilityServiceLike {
  create(
    request: unknown,
    listener: (event: TerminalEventEnvelope) => void,
  ): TerminalCreateResult;
  listLaunchTargets(): TerminalLaunchTargets;
  write(request: unknown): void;
  resize(request: unknown): void;
  close(request: unknown): void;
  closeRepository(request: unknown): number;
  dispose(): void;
}

export interface TerminalUtilityServerOptions {
  readonly onDispose?: () => void;
}

export class TerminalUtilityProtocolServer {
  readonly #port: TerminalUtilityServerPort;
  readonly #utility: TerminalUtilityServiceLike;
  readonly #instanceId = randomUUID();
  readonly #onDispose: () => void;
  #unsubscribe: (() => void) | null = null;
  #handshaken = false;
  #disposed = false;

  constructor(
    port: TerminalUtilityServerPort,
    utility: TerminalUtilityServiceLike,
    options: TerminalUtilityServerOptions = {},
  ) {
    this.#port = port;
    this.#utility = utility;
    this.#onDispose = options.onDispose ?? (() => undefined);
  }

  start(): void {
    if (this.#unsubscribe !== null || this.#disposed) return;
    this.#unsubscribe = this.#port.subscribe((message) => {
      this.#receive(message);
    });
    this.#post({
      kind: "ready",
      protocolVersion: TERMINAL_UTILITY_PROTOCOL_VERSION,
      instanceId: this.#instanceId,
    });
  }

  #receive(untrustedMessage: unknown): void {
    if (this.#disposed) return;
    const parsed = MainToTerminalUtilityMessageSchema.safeParse(untrustedMessage);
    if (!parsed.success) {
      this.#postError(
        null,
        "invalidMessage",
        parsed.error.issues[0]?.message ?? "Invalid terminal utility message",
      );
      return;
    }
    const message = parsed.data;
    if (message.kind === "handshake") {
      this.#handshake(message);
      return;
    }
    if (!this.#handshaken) {
      this.#postError(
        message.correlationId,
        "invalidRequest",
        "Handshake is required before terminal commands",
      );
      return;
    }
    try {
      this.#route(message);
    } catch (error) {
      const details = this.#errorDetails(error);
      this.#postError(message.correlationId, details.code, details.message);
    }
  }

  #handshake(
    message: Extract<
      MainToTerminalUtilityMessage,
      Readonly<{ kind: "handshake" }>
    >,
  ): void {
    if (this.#handshaken) {
      this.#postError(
        message.correlationId,
        "invalidRequest",
        "Handshake has already completed",
      );
      return;
    }
    if (
      message.protocolVersion !== TERMINAL_UTILITY_PROTOCOL_VERSION ||
      message.instanceId !== this.#instanceId
    ) {
      this.#postError(
        message.correlationId,
        "unsupportedProtocol",
        "Terminal utility protocol handshake failed",
      );
      return;
    }
    this.#handshaken = true;
    this.#post({
      kind: "handshakeAck",
      correlationId: message.correlationId,
      protocolVersion: TERMINAL_UTILITY_PROTOCOL_VERSION,
      instanceId: this.#instanceId,
    });
  }

  #route(
    message: Exclude<
      MainToTerminalUtilityMessage,
      Readonly<{ kind: "handshake" }>
    >,
  ): void {
    switch (message.kind) {
      case "create": {
        const result = this.#utility.create(message.request, (event) => {
          this.#post({ kind: "terminalEvent", event });
        });
        this.#post({ kind: "createResult", correlationId: message.correlationId, result });
        return;
      }
      case "listLaunchTargets":
        this.#post({
          kind: "listLaunchTargetsResult",
          correlationId: message.correlationId,
          targets: this.#utility.listLaunchTargets(),
        });
        return;
      case "write":
        this.#utility.write(message.request);
        this.#post({ kind: "writeResult", correlationId: message.correlationId });
        return;
      case "resize":
        this.#utility.resize(message.request);
        this.#post({ kind: "resizeResult", correlationId: message.correlationId });
        return;
      case "close":
        this.#utility.close(message.request);
        this.#post({ kind: "closeResult", correlationId: message.correlationId });
        return;
      case "closeRepository": {
        const closed = this.#utility.closeRepository(message.request);
        this.#post({
          kind: "closeRepositoryResult",
          correlationId: message.correlationId,
          closed,
        });
        return;
      }
      case "dispose": {
        this.#utility.dispose();
        this.#post({ kind: "disposeResult", correlationId: message.correlationId });
        this.#disposed = true;
        this.#unsubscribe?.();
        this.#unsubscribe = null;
        this.#onDispose();
        return;
      }
    }
  }

  #errorDetails(error: unknown): {
    readonly code: TerminalUtilityErrorCode;
    readonly message: string;
  } {
    if (error instanceof ZodError) {
      return {
        code: "invalidRequest",
        message: error.issues[0]?.message ?? "Invalid terminal request",
      };
    }
    if (error instanceof TerminalUtilityError) {
      return { code: error.code, message: error.message };
    }
    if (error instanceof Error) {
      return { code: "internalError", message: error.message.slice(0, 4_096) };
    }
    return { code: "internalError", message: "Terminal utility failed" };
  }

  #post(message: TerminalUtilityToMainMessage): void {
    this.#port.postMessage(TerminalUtilityToMainMessageSchema.parse(message));
  }

  #postError(
    correlationId: string | null,
    code: TerminalUtilityErrorCode,
    message: string,
  ): void {
    this.#post({
      kind: "error",
      correlationId,
      code,
      message: message.slice(0, 4_096) || "Terminal utility failed",
    });
  }
}
