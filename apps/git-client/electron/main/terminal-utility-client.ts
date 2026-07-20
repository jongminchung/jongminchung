import { randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";
import type { UtilityProcess } from "electron";
import type {
  TerminalCreateResult,
  TerminalEventEnvelope,
  TerminalLaunchTargets,
} from "../../src/shared/contracts/terminal";
import {
  TerminalCloseRepositoryRequestSchema,
  TerminalCloseRequestSchema,
  TerminalResizeRequestSchema,
  TerminalWriteRequestSchema,
} from "../../src/shared/contracts/terminal";
import {
  MainToTerminalUtilityMessageSchema,
  TERMINAL_UTILITY_HANDSHAKE_TIMEOUT_MS,
  TERMINAL_UTILITY_PROTOCOL_VERSION,
  TerminalUtilityCreateSpecSchema,
  TerminalUtilityToMainMessageSchema,
  type MainToTerminalUtilityMessage,
  type TerminalUtilityCorrelationId,
  type TerminalUtilityErrorCode,
  type TerminalUtilityToMainMessage,
} from "../../src/shared/contracts/terminal-utility-process";

export type TerminalUtilityTransportErrorCode =
  | TerminalUtilityErrorCode
  | "protocolViolation"
  | "utilityExited"
  | "utilityFatalError"
  | "handshakeTimeout"
  | "disposed";

export class TerminalUtilityTransportError extends Error {
  readonly code: TerminalUtilityTransportErrorCode;

  constructor(code: TerminalUtilityTransportErrorCode, message: string) {
    super(message);
    this.name = "TerminalUtilityTransportError";
    this.code = code;
  }
}

export interface TerminalUtilityProcessTransport {
  postMessage(message: unknown): void;
  subscribeMessage(listener: (message: unknown) => void): () => void;
  subscribeExit(listener: (exitCode: number) => void): () => void;
  subscribeError(listener: (message: string) => void): () => void;
  kill(): boolean;
}

export interface TerminalUtilityClientConnectOptions {
  readonly handshakeTimeoutMs?: number;
}

type TerminalUtilityClientState = "connecting" | "ready" | "disposing" | "disposed" | "crashed";

interface PendingCommand {
  readonly expectedKind:
    | "createResult"
    | "listLaunchTargetsResult"
    | "writeResult"
    | "resizeResult"
    | "closeResult"
    | "closeRepositoryResult"
    | "disposeResult";
  readonly resolve: (message: TerminalUtilityToMainMessage) => void;
  readonly reject: (error: Error) => void;
}

interface TerminalSessionListener {
  readonly repositoryId: string;
  readonly listener: (event: TerminalEventEnvelope) => void;
  terminalId: string | null;
  nextSequence: number;
}

function createElectronTransport(child: UtilityProcess): TerminalUtilityProcessTransport {
  return {
    postMessage: (message) => child.postMessage(message),
    subscribeMessage: (listener) => {
      const receive = (message: unknown): void => listener(message);
      child.on("message", receive);
      return () => child.off("message", receive);
    },
    subscribeExit: (listener) => {
      child.on("exit", listener);
      return () => child.off("exit", listener);
    },
    subscribeError: (listener) => {
      const receive = (type: "FatalError", location: string): void =>
        listener(`${type} at ${location}`);
      child.on("error", receive);
      return () => child.off("error", receive);
    },
    kill: () => child.kill(),
  };
}

export class TerminalUtilityClient {
  readonly #transport: TerminalUtilityProcessTransport;
  readonly #pending = new Map<TerminalUtilityCorrelationId, PendingCommand>();
  readonly #sessions = new Map<string, TerminalSessionListener>();
  readonly #handshakePromise: Promise<void>;
  readonly #unsubscribe: readonly (() => void)[];
  #resolveHandshake: () => void = () => undefined;
  #rejectHandshake: (error: Error) => void = () => undefined;
  #handshakeTimer: NodeJS.Timeout | null = null;
  #handshakeCorrelationId: string | null = null;
  #instanceId: string | null = null;
  #state: TerminalUtilityClientState = "connecting";
  #disposePromise: Promise<void> | null = null;

  private constructor(
    transport: TerminalUtilityProcessTransport,
    options: TerminalUtilityClientConnectOptions,
  ) {
    this.#transport = transport;
    this.#handshakePromise = new Promise((resolve, reject) => {
      this.#resolveHandshake = resolve;
      this.#rejectHandshake = reject;
    });
    this.#unsubscribe = [
      transport.subscribeMessage((message) => this.#receive(message)),
      transport.subscribeExit((exitCode) => this.#processExited(exitCode)),
      transport.subscribeError((message) => this.#processErrored(message)),
    ];
    const timeoutMs = options.handshakeTimeoutMs ?? TERMINAL_UTILITY_HANDSHAKE_TIMEOUT_MS;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      queueMicrotask(() => {
        this.#crash(
          new TerminalUtilityTransportError(
            "handshakeTimeout",
            "Handshake timeout must be positive",
          ),
        );
      });
      return;
    }
    this.#handshakeTimer = setTimeout(() => {
      this.#crash(
        new TerminalUtilityTransportError(
          "handshakeTimeout",
          "Terminal utility handshake timed out",
        ),
      );
    }, timeoutMs);
    this.#handshakeTimer.unref();
  }

  static async fork(
    entryModulePath: string,
    options: TerminalUtilityClientConnectOptions = {},
  ): Promise<TerminalUtilityClient> {
    if (!isAbsolute(entryModulePath) || entryModulePath.includes("\0")) {
      throw new TerminalUtilityTransportError(
        "invalidRequest",
        "Terminal utility entry path must be absolute",
      );
    }
    const { utilityProcess } = await import("electron");
    const child = utilityProcess.fork(entryModulePath, [], {
      serviceName: "Git Client Terminal Utility",
      stdio: "ignore",
      allowLoadingUnsignedLibraries: false,
    });
    return TerminalUtilityClient.connect(createElectronTransport(child), options);
  }

  static async connect(
    transport: TerminalUtilityProcessTransport,
    options: TerminalUtilityClientConnectOptions = {},
  ): Promise<TerminalUtilityClient> {
    const client = new TerminalUtilityClient(transport, options);
    await client.#handshakePromise;
    return client;
  }

  async create(
    untrustedRequest: unknown,
    listener: (event: TerminalEventEnvelope) => void,
  ): Promise<TerminalCreateResult> {
    this.#assertReady();
    const request = TerminalUtilityCreateSpecSchema.parse(untrustedRequest);
    if (this.#sessions.has(request.requestId)) {
      throw new TerminalUtilityTransportError(
        "invalidRequest",
        "Terminal request is already active",
      );
    }
    this.#sessions.set(request.requestId, {
      repositoryId: request.repositoryId,
      listener,
      terminalId: null,
      nextSequence: 0,
    });
    try {
      const response = await this.#request(
        { kind: "create", correlationId: randomUUID(), request },
        "createResult",
      );
      if (response.kind !== "createResult") throw this.#unexpected(response.kind);
      if (response.result.requestId !== request.requestId) {
        throw new TerminalUtilityTransportError(
          "protocolViolation",
          "Terminal create response did not match its request",
        );
      }
      const session = this.#sessions.get(request.requestId);
      if (session !== undefined) {
        if (session.terminalId !== null && session.terminalId !== response.result.terminalId) {
          throw new TerminalUtilityTransportError(
            "protocolViolation",
            "Terminal create response changed the terminal identity",
          );
        }
        session.terminalId = response.result.terminalId;
      }
      return response.result;
    } catch (error) {
      this.#sessions.delete(request.requestId);
      throw error;
    }
  }

  async listLaunchTargets(): Promise<TerminalLaunchTargets> {
    this.#assertReady();
    const response = await this.#request(
      { kind: "listLaunchTargets", correlationId: randomUUID() },
      "listLaunchTargetsResult",
    );
    if (response.kind !== "listLaunchTargetsResult") {
      throw this.#unexpected(response.kind);
    }
    return response.targets;
  }

  async write(untrustedRequest: unknown): Promise<void> {
    const request = TerminalWriteRequestSchema.parse(untrustedRequest);
    const response = await this.#request(
      { kind: "write", correlationId: randomUUID(), request },
      "writeResult",
    );
    if (response.kind !== "writeResult") throw this.#unexpected(response.kind);
  }

  async resize(untrustedRequest: unknown): Promise<void> {
    const request = TerminalResizeRequestSchema.parse(untrustedRequest);
    const response = await this.#request(
      { kind: "resize", correlationId: randomUUID(), request },
      "resizeResult",
    );
    if (response.kind !== "resizeResult") throw this.#unexpected(response.kind);
  }

  async close(untrustedRequest: unknown): Promise<void> {
    const request = TerminalCloseRequestSchema.parse(untrustedRequest);
    const response = await this.#request(
      { kind: "close", correlationId: randomUUID(), request },
      "closeResult",
    );
    if (response.kind !== "closeResult") throw this.#unexpected(response.kind);
    this.#removeTerminal(request.terminalId);
  }

  async closeRepository(untrustedRequest: unknown): Promise<number> {
    const request = TerminalCloseRepositoryRequestSchema.parse(untrustedRequest);
    const response = await this.#request(
      { kind: "closeRepository", correlationId: randomUUID(), request },
      "closeRepositoryResult",
    );
    if (response.kind !== "closeRepositoryResult") throw this.#unexpected(response.kind);
    for (const [requestId, session] of this.#sessions) {
      if (session.repositoryId === request.repositoryId) this.#sessions.delete(requestId);
    }
    return response.closed;
  }

  dispose(): Promise<void> {
    if (this.#disposePromise !== null) return this.#disposePromise;
    if (this.#state === "disposed" || this.#state === "crashed") return Promise.resolve();
    this.#assertReady();
    const responsePromise = this.#request(
      { kind: "dispose", correlationId: randomUUID() },
      "disposeResult",
    );
    this.#state = "disposing";
    this.#disposePromise = this.#finishDispose(responsePromise);
    return this.#disposePromise;
  }

  get state(): TerminalUtilityClientState {
    return this.#state;
  }

  async #finishDispose(responsePromise: Promise<TerminalUtilityToMainMessage>): Promise<void> {
    try {
      const response = await responsePromise;
      if (response.kind !== "disposeResult") throw this.#unexpected(response.kind);
      this.#state = "disposed";
      this.#clearHandshakeTimer();
      this.#rejectOutstanding(
        new TerminalUtilityTransportError("disposed", "Terminal utility client was disposed"),
      );
      this.#cleanUpSubscriptions();
      this.#transport.kill();
    } catch (error) {
      const failure =
        error instanceof Error ? error : new Error("Unable to dispose Terminal utility");
      this.#crash(failure);
      throw failure;
    }
  }

  #request(
    message: MainToTerminalUtilityMessage,
    expectedKind: PendingCommand["expectedKind"],
  ): Promise<TerminalUtilityToMainMessage> {
    this.#assertReady();
    return new Promise((resolve, reject) => {
      this.#pending.set(message.correlationId, { expectedKind, resolve, reject });
      try {
        this.#transport.postMessage(MainToTerminalUtilityMessageSchema.parse(message));
      } catch (error) {
        this.#pending.delete(message.correlationId);
        reject(
          error instanceof Error ? error : new Error("Unable to send Terminal utility message"),
        );
      }
    });
  }

  #receive(untrustedMessage: unknown): void {
    const parsed = TerminalUtilityToMainMessageSchema.safeParse(untrustedMessage);
    if (!parsed.success) {
      this.#crash(
        new TerminalUtilityTransportError(
          "protocolViolation",
          "Terminal utility sent an invalid message",
        ),
      );
      return;
    }
    const message = parsed.data;
    try {
      switch (message.kind) {
        case "ready":
          this.#ready(message);
          return;
        case "handshakeAck":
          this.#handshakeAck(message);
          return;
        case "terminalEvent":
          this.#terminalEvent(message.event);
          return;
        case "error":
          this.#remoteError(message.correlationId, message.code, message.message);
          return;
        case "createResult":
        case "listLaunchTargetsResult":
        case "writeResult":
        case "resizeResult":
        case "closeResult":
        case "closeRepositoryResult":
        case "disposeResult":
          this.#commandResult(message);
          return;
      }
    } catch (error) {
      this.#crash(
        error instanceof Error
          ? error
          : new TerminalUtilityTransportError(
              "protocolViolation",
              "Unable to route Terminal utility message",
            ),
      );
    }
  }

  #ready(message: Extract<TerminalUtilityToMainMessage, Readonly<{ kind: "ready" }>>): void {
    if (this.#state !== "connecting" || this.#instanceId !== null) {
      throw new TerminalUtilityTransportError(
        "protocolViolation",
        "Unexpected Terminal utility ready message",
      );
    }
    this.#instanceId = message.instanceId;
    this.#handshakeCorrelationId = randomUUID();
    this.#transport.postMessage(
      MainToTerminalUtilityMessageSchema.parse({
        kind: "handshake",
        correlationId: this.#handshakeCorrelationId,
        protocolVersion: TERMINAL_UTILITY_PROTOCOL_VERSION,
        instanceId: message.instanceId,
      }),
    );
  }

  #handshakeAck(
    message: Extract<TerminalUtilityToMainMessage, Readonly<{ kind: "handshakeAck" }>>,
  ): void {
    if (
      this.#state !== "connecting" ||
      message.correlationId !== this.#handshakeCorrelationId ||
      message.instanceId !== this.#instanceId ||
      message.protocolVersion !== TERMINAL_UTILITY_PROTOCOL_VERSION
    ) {
      throw new TerminalUtilityTransportError(
        "protocolViolation",
        "Terminal utility handshake response did not match",
      );
    }
    this.#state = "ready";
    this.#clearHandshakeTimer();
    this.#resolveHandshake();
  }

  #terminalEvent(event: TerminalEventEnvelope): void {
    const session = this.#sessions.get(event.requestId);
    if (session === undefined) {
      throw new TerminalUtilityTransportError(
        "protocolViolation",
        "Uncorrelated Terminal utility event",
      );
    }
    if (session.terminalId === null) session.terminalId = event.terminalId;
    if (session.terminalId !== event.terminalId) {
      throw new TerminalUtilityTransportError(
        "protocolViolation",
        "Terminal utility changed a session identity",
      );
    }
    if (event.kind === "output") {
      if (event.sequence !== session.nextSequence) {
        throw new TerminalUtilityTransportError(
          "protocolViolation",
          "Out-of-order Terminal utility output event",
        );
      }
      session.nextSequence += 1;
    }
    try {
      session.listener(event);
    } catch {
      // Consumer exceptions do not compromise PTY lifecycle or transport routing.
    }
    if (event.kind === "exited" || event.kind === "failed") {
      this.#sessions.delete(event.requestId);
    }
  }

  #commandResult(
    message: Extract<
      TerminalUtilityToMainMessage,
      Readonly<{
        kind:
          | "createResult"
          | "listLaunchTargetsResult"
          | "writeResult"
          | "resizeResult"
          | "closeResult"
          | "closeRepositoryResult"
          | "disposeResult";
      }>
    >,
  ): void {
    const pending = this.#pending.get(message.correlationId);
    if (pending === undefined || pending.expectedKind !== message.kind) {
      throw new TerminalUtilityTransportError(
        "protocolViolation",
        "Uncorrelated Terminal utility response",
      );
    }
    this.#pending.delete(message.correlationId);
    pending.resolve(message);
  }

  #remoteError(
    correlationId: TerminalUtilityCorrelationId | null,
    code: TerminalUtilityErrorCode,
    message: string,
  ): void {
    const error = new TerminalUtilityTransportError(code, message);
    if (correlationId === null) {
      throw error;
    }
    if (correlationId === this.#handshakeCorrelationId && this.#state === "connecting") {
      throw error;
    }
    const pending = this.#pending.get(correlationId);
    if (pending === undefined) {
      throw new TerminalUtilityTransportError(
        "protocolViolation",
        "Uncorrelated Terminal utility error",
      );
    }
    this.#pending.delete(correlationId);
    pending.reject(error);
  }

  #processExited(exitCode: number): void {
    if (this.#state === "disposed") return;
    this.#crash(
      new TerminalUtilityTransportError(
        "utilityExited",
        `Terminal utility process exited with code ${exitCode}`,
      ),
      false,
    );
  }

  #processErrored(message: string): void {
    this.#crash(new TerminalUtilityTransportError("utilityFatalError", message), false);
  }

  #removeTerminal(terminalId: string): void {
    for (const [requestId, session] of this.#sessions) {
      if (session.terminalId === terminalId) this.#sessions.delete(requestId);
    }
  }

  #assertReady(): void {
    if (this.#state !== "ready") {
      throw new TerminalUtilityTransportError(
        this.#state === "disposed" ? "disposed" : "protocolViolation",
        `Terminal utility client is ${this.#state}`,
      );
    }
  }

  #unexpected(kind: string): TerminalUtilityTransportError {
    return new TerminalUtilityTransportError(
      "protocolViolation",
      `Unexpected Terminal utility response: ${kind}`,
    );
  }

  #crash(error: Error, kill = true): void {
    if (this.#state === "disposed" || this.#state === "crashed") return;
    this.#state = "crashed";
    this.#clearHandshakeTimer();
    this.#rejectHandshake(error);
    this.#rejectOutstanding(error);
    this.#cleanUpSubscriptions();
    if (kill) this.#transport.kill();
  }

  #rejectOutstanding(error: Error): void {
    for (const pending of this.#pending.values()) pending.reject(error);
    this.#pending.clear();
    this.#sessions.clear();
  }

  #clearHandshakeTimer(): void {
    if (this.#handshakeTimer === null) return;
    clearTimeout(this.#handshakeTimer);
    this.#handshakeTimer = null;
  }

  #cleanUpSubscriptions(): void {
    for (const unsubscribe of this.#unsubscribe) unsubscribe();
  }
}
