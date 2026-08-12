import { randomUUID } from "node:crypto";
import type {
    GitCreationEvent,
    GitCreationEventListener,
    GitCreationOperation,
    GitCreationTerminalEvent,
    GitEventListener,
    GitRequestEvent,
    GitTerminalEvent,
    RepositoryChangedEvent,
    RepositoryChangedListener,
    RepositoryId,
} from "../../src/shared/contracts/git-utility";
import {
    GIT_UTILITY_HANDSHAKE_TIMEOUT_MS,
    GIT_UTILITY_PROTOCOL_VERSION,
    GitUtilityToMainMessageSchema,
    MainToGitUtilityMessageSchema,
    type GitUtilityProtocolErrorCode,
    type GitUtilityToMainMessage,
    type MainToGitUtilityMessage,
    type UtilityCorrelationId,
} from "../../src/shared/contracts/git-utility-process";
import {
    GitUtilityTransportError,
    type GitUtilityClientConnectOptions,
    type GitUtilityProcessTransport,
} from "./git-utility-transport";

type ExpectedCommandKind =
    | "openRepositoryResult"
    | "closeRepositoryResult"
    | "inspectSnapshotResult"
    | "repositoryServiceResult"
    | "cancelResult"
    | "readFileResult"
    | "readFilePreviewResult"
    | "writeWorkingTreeFileResult"
    | "watchRepositoryResult"
    | "unwatchRepositoryResult"
    | "disposeResult";

interface PendingCommand {
    readonly expectedKind: ExpectedCommandKind;
    readonly resolve: (message: GitUtilityToMainMessage) => void;
    readonly reject: (error: Error) => void;
}

interface PendingQuery {
    readonly requestId: string;
    readonly listener: GitEventListener;
    readonly resolve: (event: GitTerminalEvent) => void;
    readonly reject: (error: Error) => void;
    phase: "awaitingStarted" | "running";
    nextSequence: number;
}

interface PendingCreation {
    readonly requestId: string;
    readonly operation: GitCreationOperation;
    readonly listener: GitCreationEventListener;
    readonly resolve: (event: GitCreationTerminalEvent) => void;
    readonly reject: (error: Error) => void;
    phase: "awaitingStarted" | "running";
    nextSequence: number;
}

export type GitUtilityClientState =
    | "connecting"
    | "ready"
    | "disposing"
    | "disposed"
    | "crashed";

export class GitUtilityProtocolRuntime {
    readonly #pendingCommands = new Map<UtilityCorrelationId, PendingCommand>();
    readonly #pendingQueries = new Map<UtilityCorrelationId, PendingQuery>();
    readonly #pendingCreations = new Map<
        UtilityCorrelationId,
        PendingCreation
    >();
    readonly #watchListeners = new Map<
        RepositoryId,
        RepositoryChangedListener
    >();
    readonly #readyPromise: Promise<void>;
    readonly #unsubscribe: Array<() => void>;
    #resolveReady: () => void = () => undefined;
    #rejectReady: (error: Error) => void = () => undefined;
    #handshakeTimer: NodeJS.Timeout | null = null;
    #handshakeCorrelationId: UtilityCorrelationId | null = null;
    #instanceId: string | null = null;
    #state: GitUtilityClientState = "connecting";
    #disposePromise: Promise<void> | null = null;

    constructor(
        readonly transport: GitUtilityProcessTransport,
        options: GitUtilityClientConnectOptions,
    ) {
        this.#readyPromise = new Promise((resolve, reject) => {
            this.#resolveReady = resolve;
            this.#rejectReady = reject;
        });
        this.#unsubscribe = [
            transport.subscribeMessage((message) => this.#receive(message)),
            transport.subscribeExit((exitCode) =>
                this.#processExited(exitCode),
            ),
            transport.subscribeError((message) =>
                this.#processErrored(message),
            ),
        ];
        const timeoutMs =
            options.handshakeTimeoutMs ?? GIT_UTILITY_HANDSHAKE_TIMEOUT_MS;
        if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
            queueMicrotask(() =>
                this.#crash(
                    new GitUtilityTransportError(
                        "handshakeTimeout",
                        "Handshake timeout must be positive",
                    ),
                ),
            );
            return;
        }
        this.#handshakeTimer = setTimeout(
            () =>
                this.#crash(
                    new GitUtilityTransportError(
                        "handshakeTimeout",
                        "Git utility handshake timed out",
                    ),
                ),
            timeoutMs,
        );
        this.#handshakeTimer.unref();
        this.#onCrash = options.onCrash;
    }

    readonly #onCrash: ((error: Error) => void) | undefined;

    ready(): Promise<void> {
        return this.#readyPromise;
    }

    get state(): GitUtilityClientState {
        return this.#state;
    }

    assertReady(): void {
        if (this.#state !== "ready") {
            throw new GitUtilityTransportError(
                this.#state === "disposed" ? "disposed" : "protocolViolation",
                `Git utility client is ${this.#state}`,
            );
        }
    }

    unexpected(kind: string): GitUtilityTransportError {
        return new GitUtilityTransportError(
            "protocolViolation",
            `Unexpected Git utility response: ${kind}`,
        );
    }

    request(
        message: MainToGitUtilityMessage,
        expectedKind: ExpectedCommandKind,
    ): Promise<GitUtilityToMainMessage> {
        this.assertReady();
        return new Promise((resolve, reject) => {
            this.#pendingCommands.set(message.correlationId, {
                expectedKind,
                resolve,
                reject,
            });
            try {
                this.#send(message);
            } catch (error) {
                this.#pendingCommands.delete(message.correlationId);
                reject(
                    error instanceof Error
                        ? error
                        : new Error("Unable to send Git utility message"),
                );
            }
        });
    }

    executeQuery(
        message: Extract<MainToGitUtilityMessage, Readonly<{ kind: "query" }>>,
        listener: GitEventListener,
    ): Promise<GitTerminalEvent> {
        const promise = new Promise<GitTerminalEvent>((resolve, reject) => {
            this.#pendingQueries.set(message.correlationId, {
                requestId: message.request.requestId,
                listener,
                resolve,
                reject,
                phase: "awaitingStarted",
                nextSequence: 0,
            });
        });
        try {
            this.#send(message);
        } catch (error) {
            this.#pendingQueries.delete(message.correlationId);
            throw error;
        }
        return promise;
    }

    executeCreation(
        message: Extract<
            MainToGitUtilityMessage,
            Readonly<{ kind: "initializeRepository" | "cloneRepository" }>
        >,
        operation: GitCreationOperation,
        listener: GitCreationEventListener,
    ): Promise<GitCreationTerminalEvent> {
        const promise = new Promise<GitCreationTerminalEvent>(
            (resolve, reject) => {
                this.#pendingCreations.set(message.correlationId, {
                    requestId: message.request.requestId,
                    operation,
                    listener,
                    resolve,
                    reject,
                    phase: "awaitingStarted",
                    nextSequence: 0,
                });
            },
        );
        try {
            this.#send(message);
        } catch (error) {
            this.#pendingCreations.delete(message.correlationId);
            throw error;
        }
        return promise;
    }

    setWatchListener(
        repositoryId: RepositoryId,
        listener: RepositoryChangedListener,
    ): void {
        this.#watchListeners.set(repositoryId, listener);
    }

    hasWatchListener(repositoryId: RepositoryId): boolean {
        return this.#watchListeners.has(repositoryId);
    }

    clearWatchListener(
        repositoryId: RepositoryId,
        listener?: RepositoryChangedListener,
    ): void {
        if (
            listener === undefined ||
            this.#watchListeners.get(repositoryId) === listener
        ) {
            this.#watchListeners.delete(repositoryId);
        }
    }

    dispose(): Promise<void> {
        if (this.#disposePromise !== null) return this.#disposePromise;
        if (this.#state === "disposed" || this.#state === "crashed")
            return Promise.resolve();
        this.assertReady();
        const responsePromise = this.request(
            { kind: "dispose", correlationId: randomUUID() },
            "disposeResult",
        );
        this.#state = "disposing";
        this.#disposePromise = responsePromise
            .then((response) => {
                if (response.kind !== "disposeResult")
                    throw this.unexpected(response.kind);
                this.#state = "disposed";
                this.#clearHandshakeTimer();
                this.#rejectOutstanding(
                    new GitUtilityTransportError(
                        "disposed",
                        "Git utility client was disposed",
                    ),
                );
                this.#cleanUpSubscriptions();
                this.transport.kill();
            })
            .catch((error: unknown) => {
                const failure =
                    error instanceof Error
                        ? error
                        : new Error("Unable to dispose Git utility");
                this.#crash(failure);
                throw failure;
            });
        return this.#disposePromise;
    }

    #receive(untrustedMessage: unknown): void {
        const parsed =
            GitUtilityToMainMessageSchema.safeParse(untrustedMessage);
        if (!parsed.success) {
            this.#crash(
                new GitUtilityTransportError(
                    "protocolViolation",
                    "Git utility sent an invalid message",
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
                case "queryEvent":
                    this.#queryEvent(message.correlationId, message.event);
                    return;
                case "creationEvent":
                    this.#creationEvent(message.correlationId, message.event);
                    return;
                case "repositoryChanged":
                    this.#repositoryChanged(message.event);
                    return;
                case "error":
                    this.#remoteError(
                        message.correlationId,
                        message.code,
                        message.message,
                    );
                    return;
                default:
                    this.#commandResult(message);
            }
        } catch (error) {
            this.#crash(
                error instanceof Error
                    ? error
                    : new GitUtilityTransportError(
                          "protocolViolation",
                          "Unable to route Git utility message",
                      ),
            );
        }
    }

    #ready(
        message: Extract<GitUtilityToMainMessage, Readonly<{ kind: "ready" }>>,
    ): void {
        if (this.#state !== "connecting" || this.#instanceId !== null) {
            this.#crash(
                new GitUtilityTransportError(
                    "protocolViolation",
                    "Unexpected Git utility ready message",
                ),
            );
            return;
        }
        this.#instanceId = message.instanceId;
        this.#handshakeCorrelationId = randomUUID();
        this.#send({
            kind: "handshake",
            correlationId: this.#handshakeCorrelationId,
            protocolVersion: GIT_UTILITY_PROTOCOL_VERSION,
            instanceId: message.instanceId,
        });
    }

    #handshakeAck(
        message: Extract<
            GitUtilityToMainMessage,
            Readonly<{ kind: "handshakeAck" }>
        >,
    ): void {
        if (
            this.#state !== "connecting" ||
            message.correlationId !== this.#handshakeCorrelationId ||
            message.instanceId !== this.#instanceId ||
            message.protocolVersion !== GIT_UTILITY_PROTOCOL_VERSION
        ) {
            this.#crash(
                new GitUtilityTransportError(
                    "protocolViolation",
                    "Git utility handshake response did not match",
                ),
            );
            return;
        }
        this.#state = "ready";
        this.#clearHandshakeTimer();
        this.#resolveReady();
    }

    #queryEvent(
        correlationId: UtilityCorrelationId,
        event: GitRequestEvent,
    ): void {
        const pending = this.#pendingQueries.get(correlationId);
        if (pending === undefined || event.requestId !== pending.requestId) {
            this.#crash(
                new GitUtilityTransportError(
                    "protocolViolation",
                    "Uncorrelated Git query event",
                ),
            );
            return;
        }
        if (event.kind === "started") {
            if (pending.phase !== "awaitingStarted") {
                this.#crash(
                    new GitUtilityTransportError(
                        "protocolViolation",
                        "Duplicate Git query start event",
                    ),
                );
                return;
            }
            pending.phase = "running";
        } else if (event.kind === "output") {
            if (
                pending.phase !== "running" ||
                event.sequence !== pending.nextSequence
            ) {
                this.#crash(
                    new GitUtilityTransportError(
                        "protocolViolation",
                        "Out-of-order Git query output event",
                    ),
                );
                return;
            }
            pending.nextSequence += 1;
        } else if (pending.phase !== "running") {
            this.#crash(
                new GitUtilityTransportError(
                    "protocolViolation",
                    "Git query terminated before starting",
                ),
            );
            return;
        }
        try {
            pending.listener(event);
        } catch {
            // Consumer exceptions do not compromise process lifecycle or message routing.
        }
        if (
            event.kind === "completed" ||
            event.kind === "failed" ||
            event.kind === "cancelled"
        ) {
            this.#pendingQueries.delete(correlationId);
            pending.resolve(event);
        }
    }

    #creationEvent(
        correlationId: UtilityCorrelationId,
        event: GitCreationEvent,
    ): void {
        const pending = this.#pendingCreations.get(correlationId);
        if (
            pending === undefined ||
            event.requestId !== pending.requestId ||
            event.operation !== pending.operation
        ) {
            this.#crash(
                new GitUtilityTransportError(
                    "protocolViolation",
                    "Uncorrelated Git creation event",
                ),
            );
            return;
        }
        if (event.kind === "started") {
            if (pending.phase !== "awaitingStarted") {
                this.#crash(
                    new GitUtilityTransportError(
                        "protocolViolation",
                        "Duplicate Git creation start event",
                    ),
                );
                return;
            }
            pending.phase = "running";
        } else if (event.kind === "output" || event.kind === "progress") {
            if (
                pending.phase !== "running" ||
                event.sequence !== pending.nextSequence
            ) {
                this.#crash(
                    new GitUtilityTransportError(
                        "protocolViolation",
                        "Out-of-order Git creation event",
                    ),
                );
                return;
            }
            pending.nextSequence += 1;
        } else if (pending.phase !== "running") {
            this.#crash(
                new GitUtilityTransportError(
                    "protocolViolation",
                    "Git creation terminated before starting",
                ),
            );
            return;
        }
        try {
            pending.listener(event);
        } catch {
            // Consumer exceptions do not compromise process lifecycle or message routing.
        }
        if (
            event.kind === "completed" ||
            event.kind === "failed" ||
            event.kind === "cancelled"
        ) {
            this.#pendingCreations.delete(correlationId);
            pending.resolve(event);
        }
    }

    #repositoryChanged(event: RepositoryChangedEvent): void {
        try {
            this.#watchListeners.get(event.repositoryId)?.(event);
        } catch {
            // Consumer exceptions do not compromise watcher cleanup or later invalidations.
        }
    }

    #commandResult(message: GitUtilityToMainMessage): void {
        if (
            message.kind === "ready" ||
            message.kind === "handshakeAck" ||
            message.kind === "queryEvent" ||
            message.kind === "creationEvent" ||
            message.kind === "repositoryChanged" ||
            message.kind === "error"
        ) {
            this.#crash(
                new GitUtilityTransportError(
                    "protocolViolation",
                    "Unexpected Git utility response",
                ),
            );
            return;
        }
        const pending = this.#pendingCommands.get(message.correlationId);
        if (pending === undefined || pending.expectedKind !== message.kind) {
            this.#crash(
                new GitUtilityTransportError(
                    "protocolViolation",
                    "Uncorrelated Git utility response",
                ),
            );
            return;
        }
        this.#pendingCommands.delete(message.correlationId);
        pending.resolve(message);
    }

    #remoteError(
        correlationId: UtilityCorrelationId | null,
        code: GitUtilityProtocolErrorCode,
        message: string,
    ): void {
        const error = new GitUtilityTransportError(code, message);
        if (
            correlationId === null ||
            (correlationId === this.#handshakeCorrelationId &&
                this.#state === "connecting")
        ) {
            this.#crash(error);
            return;
        }
        const command = this.#pendingCommands.get(correlationId);
        if (command !== undefined) {
            this.#pendingCommands.delete(correlationId);
            command.reject(error);
            return;
        }
        const query = this.#pendingQueries.get(correlationId);
        if (query !== undefined) {
            this.#pendingQueries.delete(correlationId);
            query.reject(error);
            return;
        }
        const creation = this.#pendingCreations.get(correlationId);
        if (creation !== undefined) {
            this.#pendingCreations.delete(correlationId);
            creation.reject(error);
            return;
        }
        this.#crash(
            new GitUtilityTransportError(
                "protocolViolation",
                "Uncorrelated Git utility error",
            ),
        );
    }

    #processExited(exitCode: number): void {
        if (this.#state === "disposed") return;
        this.#crash(
            new GitUtilityTransportError(
                "utilityExited",
                `Git utility process exited with code ${exitCode}`,
            ),
            false,
        );
    }

    #processErrored(message: string): void {
        this.#crash(
            new GitUtilityTransportError("utilityFatalError", message),
            false,
        );
    }

    #send(message: MainToGitUtilityMessage): void {
        this.transport.postMessage(
            MainToGitUtilityMessageSchema.parse(message),
        );
    }

    #crash(error: Error, kill = true): void {
        if (this.#state === "disposed" || this.#state === "crashed") return;
        this.#state = "crashed";
        this.#clearHandshakeTimer();
        this.#rejectReady(error);
        this.#rejectOutstanding(error);
        this.#cleanUpSubscriptions();
        if (kill) this.transport.kill();
        try {
            this.#onCrash?.(error);
        } catch (callbackError) {
            console.error(
                "[git-client] Git utility crash observer failed",
                callbackError,
            );
        }
    }

    #rejectOutstanding(error: Error): void {
        for (const pending of this.#pendingCommands.values())
            pending.reject(error);
        for (const pending of this.#pendingQueries.values())
            pending.reject(error);
        for (const pending of this.#pendingCreations.values())
            pending.reject(error);
        this.#pendingCommands.clear();
        this.#pendingQueries.clear();
        this.#pendingCreations.clear();
        this.#watchListeners.clear();
    }

    #clearHandshakeTimer(): void {
        if (this.#handshakeTimer === null) return;
        clearTimeout(this.#handshakeTimer);
        this.#handshakeTimer = null;
    }

    #cleanUpSubscriptions(): void {
        for (const unsubscribe of this.#unsubscribe.splice(0)) unsubscribe();
    }
}
