import { randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";
import type { UtilityProcess } from "electron";
import {
    GitCloneRepositoryRequestSchema,
    GitReadFileRequestSchema,
    GitWriteWorkingTreeFileRequestSchema,
    GitRepositoryServiceRequestSchema,
    GitInitializeRepositoryRequestSchema,
    GitExecutionRequestSchema,
    GitRequestIdSchema,
    OpenRepositoryRequestSchema,
    RepositoryIdSchema,
    type GitCloneRepositoryRequest,
    type GitCreationEvent,
    type GitCreationEventListener,
    type GitCreationOperation,
    type GitCreationTerminalEvent,
    type GitEventListener,
    type GitRequestEvent,
    type GitRepositoryServiceRequest,
    type GitRepositoryServiceResult,
    type GitBranchComparison,
    type GitPreCommitCheck,
    type GitConfigEntry,
    type GitSubmoduleInfo,
    type GitCommitSignature,
    type GitRemoteInfo,
    type GitWorktreeInfo,
    type GitIgnoreRules,
    type GitPushPreview,
    type GitHistoryRewritePreview,
    type GitMultiRootOutcome,
    type GitMultiRootResult,
    type GitMultiRootRollbackStep,
    type GitPatchExportResult,
    type GitShelfEntry,
    type GitChangelist,
    type GitChangelistCommitResult,
    type GitRecoveryEntry,
    type GitRecoveryRestoreResult,
    type GitConflictFile,
    type GitConflictContent,
    type GitTerminalEvent,
    type FileContent,
    type FilePreview,
    type FileSource,
    type GitSubmoduleDiff,
    type RepositoryChangedEvent,
    type RepositoryChangedListener,
    type RepositoryId,
    type RepositoryRecord,
    type RepositorySnapshot,
} from "../../src/shared/contracts/git-utility";
import type { GitOperation } from "../../src/generated";
import {
    GIT_UTILITY_HANDSHAKE_TIMEOUT_MS,
    GIT_UTILITY_PROTOCOL_VERSION,
    GIT_UTILITY_STORAGE_ROOT_ARGUMENT,
    GitUtilityToMainMessageSchema,
    GitUtilityStorageRootSchema,
    MainToGitUtilityMessageSchema,
    type GitUtilityProtocolErrorCode,
    type GitUtilityToMainMessage,
    type MainToGitUtilityMessage,
    type UtilityCorrelationId,
} from "../../src/shared/contracts/git-utility-process";

export type GitUtilityTransportErrorCode =
    | GitUtilityProtocolErrorCode
    | "protocolViolation"
    | "utilityExited"
    | "utilityFatalError"
    | "handshakeTimeout"
    | "disposed";

export class GitUtilityTransportError extends Error {
    readonly code: GitUtilityTransportErrorCode;

    constructor(code: GitUtilityTransportErrorCode, message: string) {
        super(message);
        this.name = "GitUtilityTransportError";
        this.code = code;
    }
}

export interface GitUtilityProcessTransport {
    postMessage(message: unknown): void;
    subscribeMessage(listener: (message: unknown) => void): () => void;
    subscribeExit(listener: (exitCode: number) => void): () => void;
    subscribeError(listener: (message: string) => void): () => void;
    kill(): boolean;
}

export interface GitUtilityClientConnectOptions {
    readonly handshakeTimeoutMs?: number;
}

export interface GitUtilityClientForkOptions extends GitUtilityClientConnectOptions {
    readonly storageRoot: string;
}

interface PendingCommand {
    readonly expectedKind:
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

type ClientState =
    | "connecting"
    | "ready"
    | "disposing"
    | "disposed"
    | "crashed";

function createElectronTransport(
    child: UtilityProcess,
): GitUtilityProcessTransport {
    return {
        postMessage: (message) => child.postMessage(message),
        subscribeMessage: (listener) => {
            const receive = (message: unknown) => listener(message);
            child.on("message", receive);
            return () => child.off("message", receive);
        },
        subscribeExit: (listener) => {
            child.on("exit", listener);
            return () => child.off("exit", listener);
        },
        subscribeError: (listener) => {
            const receive = (type: "FatalError", location: string) =>
                listener(`${type} at ${location}`);
            child.on("error", receive);
            return () => child.off("error", receive);
        },
        kill: () => child.kill(),
    };
}

export class GitUtilityClient {
    readonly #transport: GitUtilityProcessTransport;
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
    readonly #handshakePromise: Promise<void>;
    readonly #unsubscribe: Array<() => void>;
    #resolveHandshake: () => void = () => undefined;
    #rejectHandshake: (error: Error) => void = () => undefined;
    #handshakeTimer: NodeJS.Timeout | null = null;
    #handshakeCorrelationId: UtilityCorrelationId | null = null;
    #instanceId: string | null = null;
    #state: ClientState = "connecting";
    #disposePromise: Promise<void> | null = null;

    private constructor(
        transport: GitUtilityProcessTransport,
        options: GitUtilityClientConnectOptions,
    ) {
        this.#transport = transport;
        this.#handshakePromise = new Promise((resolve, reject) => {
            this.#resolveHandshake = resolve;
            this.#rejectHandshake = reject;
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
            queueMicrotask(() => {
                this.#crash(
                    new GitUtilityTransportError(
                        "handshakeTimeout",
                        "Handshake timeout must be positive",
                    ),
                );
            });
            return;
        }
        this.#handshakeTimer = setTimeout(() => {
            this.#crash(
                new GitUtilityTransportError(
                    "handshakeTimeout",
                    "Git utility handshake timed out",
                ),
            );
        }, timeoutMs);
        this.#handshakeTimer.unref();
    }

    static async fork(
        entryModulePath: string,
        options: GitUtilityClientForkOptions,
    ): Promise<GitUtilityClient> {
        if (!isAbsolute(entryModulePath) || entryModulePath.includes("\0")) {
            throw new GitUtilityTransportError(
                "invalidRequest",
                "Git utility entry path must be absolute",
            );
        }
        const storageRoot = GitUtilityStorageRootSchema.parse(
            options.storageRoot,
        );
        const { utilityProcess } = await import("electron");
        const child = utilityProcess.fork(
            entryModulePath,
            [GIT_UTILITY_STORAGE_ROOT_ARGUMENT, storageRoot],
            {
                serviceName: "Git Client Git Utility",
                stdio: "ignore",
                allowLoadingUnsignedLibraries: false,
            },
        );
        return GitUtilityClient.connect(createElectronTransport(child), {
            handshakeTimeoutMs: options.handshakeTimeoutMs,
        });
    }

    static async connect(
        transport: GitUtilityProcessTransport,
        options: GitUtilityClientConnectOptions = {},
    ): Promise<GitUtilityClient> {
        const client = new GitUtilityClient(transport, options);
        await client.#handshakePromise;
        return client;
    }

    async openRepository(path: string): Promise<RepositoryRecord> {
        this.#assertReady();
        const request = OpenRepositoryRequestSchema.parse({ path });
        const response = await this.#request(
            { kind: "openRepository", correlationId: randomUUID(), request },
            "openRepositoryResult",
        );
        if (response.kind !== "openRepositoryResult")
            throw this.#unexpected(response.kind);
        return response.repository;
    }

    initializeRepository(
        untrustedRequest: unknown,
        listener: GitCreationEventListener,
    ): Promise<GitCreationTerminalEvent> {
        this.#assertReady();
        const request =
            GitInitializeRepositoryRequestSchema.parse(untrustedRequest);
        return this.#executeCreation(
            {
                kind: "initializeRepository",
                correlationId: randomUUID(),
                request,
            },
            request.requestId,
            "initialize",
            listener,
        );
    }

    cloneRepository(
        untrustedRequest: GitCloneRepositoryRequest,
        listener: GitCreationEventListener,
    ): Promise<GitCreationTerminalEvent> {
        this.#assertReady();
        const request = GitCloneRepositoryRequestSchema.parse(untrustedRequest);
        return this.#executeCreation(
            { kind: "cloneRepository", correlationId: randomUUID(), request },
            request.requestId,
            "clone",
            listener,
        );
    }

    async closeRepository(repositoryId: RepositoryId): Promise<boolean> {
        this.#assertReady();
        const id = RepositoryIdSchema.parse(repositoryId);
        const response = await this.#request(
            {
                kind: "closeRepository",
                correlationId: randomUUID(),
                repositoryId: id,
            },
            "closeRepositoryResult",
        );
        if (response.kind !== "closeRepositoryResult")
            throw this.#unexpected(response.kind);
        this.#watchListeners.delete(id);
        return response.closed;
    }

    async inspectSnapshot(
        repositoryId: RepositoryId,
    ): Promise<RepositorySnapshot> {
        this.#assertReady();
        const id = RepositoryIdSchema.parse(repositoryId);
        const response = await this.#request(
            {
                kind: "inspectSnapshot",
                correlationId: randomUUID(),
                repositoryId: id,
            },
            "inspectSnapshotResult",
        );
        if (response.kind !== "inspectSnapshotResult")
            throw this.#unexpected(response.kind);
        return response.snapshot;
    }

    async compareBranches(
        repositoryId: RepositoryId,
        left: string,
        right: string,
    ): Promise<GitBranchComparison> {
        const result = await this.#repositoryService({
            operation: "compareBranches",
            repositoryId,
            left,
            right,
        });
        if (result.operation !== "compareBranches")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async preCommitCheck(
        repositoryId: RepositoryId,
    ): Promise<GitPreCommitCheck> {
        const result = await this.#repositoryService({
            operation: "preCommitCheck",
            repositoryId,
        });
        if (result.operation !== "preCommitCheck")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async listGitConfig(
        repositoryId: RepositoryId,
    ): Promise<readonly GitConfigEntry[]> {
        const result = await this.#repositoryService({
            operation: "listGitConfig",
            repositoryId,
        });
        if (result.operation !== "listGitConfig")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async listSubmodules(
        repositoryId: RepositoryId,
    ): Promise<readonly GitSubmoduleInfo[]> {
        const result = await this.#repositoryService({
            operation: "listSubmodules",
            repositoryId,
        });
        if (result.operation !== "listSubmodules")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async listMergedBranches(
        repositoryId: RepositoryId,
        target: string,
    ): Promise<readonly string[]> {
        const result = await this.#repositoryService({
            operation: "listMergedBranches",
            repositoryId,
            target,
        });
        if (result.operation !== "listMergedBranches")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async loadCommitSignature(
        repositoryId: RepositoryId,
        revision: string,
    ): Promise<GitCommitSignature> {
        const result = await this.#repositoryService({
            operation: "loadCommitSignature",
            repositoryId,
            revision,
        });
        if (result.operation !== "loadCommitSignature")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async listRemotes(
        repositoryId: RepositoryId,
    ): Promise<readonly GitRemoteInfo[]> {
        const result = await this.#repositoryService({
            operation: "listRemotes",
            repositoryId,
        });
        if (result.operation !== "listRemotes")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async listWorktrees(
        repositoryId: RepositoryId,
    ): Promise<readonly GitWorktreeInfo[]> {
        const result = await this.#repositoryService({
            operation: "listWorktrees",
            repositoryId,
        });
        if (result.operation !== "listWorktrees")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async readIgnoreRules(repositoryId: RepositoryId): Promise<GitIgnoreRules> {
        const result = await this.#repositoryService({
            operation: "readIgnoreRules",
            repositoryId,
        });
        if (result.operation !== "readIgnoreRules")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async writeIgnoreRules(
        repositoryId: RepositoryId,
        rules: GitIgnoreRules,
    ): Promise<void> {
        const result = await this.#repositoryService({
            operation: "writeIgnoreRules",
            repositoryId,
            rules,
        });
        if (result.operation !== "writeIgnoreRules")
            throw this.#unexpected(result.operation);
    }

    async loadPushPreview(
        repositoryId: RepositoryId,
        remote: string | null,
        remoteRef: string | null,
        localRevision: string,
    ): Promise<GitPushPreview> {
        const result = await this.#repositoryService({
            operation: "pushPreview",
            repositoryId,
            remote,
            remoteRef,
            localRevision,
        });
        if (result.operation !== "pushPreview")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async loadHistoryRewritePreview(
        repositoryId: RepositoryId,
        fromRevision: string,
    ): Promise<GitHistoryRewritePreview> {
        const result = await this.#repositoryService({
            operation: "historyRewritePreview",
            repositoryId,
            fromRevision,
        });
        if (result.operation !== "historyRewritePreview")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    executeRepositoryService(
        request: GitRepositoryServiceRequest,
    ): Promise<GitRepositoryServiceResult> {
        return this.#repositoryService(request);
    }

    async loadSubmoduleDiff(
        repositoryId: RepositoryId,
        before: FileSource,
        after: FileSource,
        path: string,
    ): Promise<GitSubmoduleDiff> {
        const result = await this.#repositoryService({
            operation: "loadSubmoduleDiff",
            repositoryId,
            before,
            after,
            path,
        });
        if (result.operation !== "loadSubmoduleDiff")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async resolveWorkingTreeFile(
        repositoryId: RepositoryId,
        path: string,
    ): Promise<string> {
        const result = await this.#repositoryService({
            operation: "resolveWorkingTreeFile",
            repositoryId,
            path,
        });
        if (result.operation !== "resolveWorkingTreeFile")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async executeSynchronizedBranchOperation(
        repositoryIds: readonly RepositoryId[],
        gitOperation: GitOperation,
    ): Promise<GitMultiRootResult> {
        const result = await this.#repositoryService({
            operation: "executeSynchronizedBranchOperation",
            repositoryIds,
            gitOperation,
        });
        if (result.operation !== "executeSynchronizedBranchOperation")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async applyMultiRootRollback(
        steps: readonly GitMultiRootRollbackStep[],
    ): Promise<readonly GitMultiRootOutcome[]> {
        const result = await this.#repositoryService({
            operation: "applyMultiRootRollback",
            steps,
        });
        if (result.operation !== "applyMultiRootRollback")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async exportPatch(
        repositoryId: RepositoryId,
        revisions: readonly string[],
        targetPath: string,
    ): Promise<GitPatchExportResult> {
        const result = await this.#repositoryService({
            operation: "exportPatch",
            repositoryId,
            revisions,
            targetPath,
        });
        if (result.operation !== "exportPatch")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async createPatchText(
        repositoryId: RepositoryId,
        revisions: readonly string[],
    ): Promise<string> {
        const result = await this.#repositoryService({
            operation: "createPatchText",
            repositoryId,
            revisions,
        });
        if (result.operation !== "createPatchText")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async importPatch(repositoryId: RepositoryId, path: string): Promise<void> {
        const result = await this.#repositoryService({
            operation: "importPatch",
            repositoryId,
            path,
        });
        if (result.operation !== "importPatch")
            throw this.#unexpected(result.operation);
    }

    async createShelf(
        repositoryId: RepositoryId,
        message: string,
        paths: readonly string[],
    ): Promise<GitShelfEntry> {
        const result = await this.#repositoryService({
            operation: "createShelf",
            repositoryId,
            message,
            paths,
        });
        if (result.operation !== "createShelf")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async listShelves(
        repositoryId: RepositoryId,
    ): Promise<readonly GitShelfEntry[]> {
        const result = await this.#repositoryService({
            operation: "listShelves",
            repositoryId,
        });
        if (result.operation !== "listShelves")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async applyShelf(
        repositoryId: RepositoryId,
        shelfId: string,
        dropAfterApply: boolean,
    ): Promise<void> {
        const result = await this.#repositoryService({
            operation: "applyShelf",
            repositoryId,
            shelfId,
            dropAfterApply,
        });
        if (result.operation !== "applyShelf")
            throw this.#unexpected(result.operation);
    }

    async deleteShelf(
        repositoryId: RepositoryId,
        shelfId: string,
    ): Promise<void> {
        const result = await this.#repositoryService({
            operation: "deleteShelf",
            repositoryId,
            shelfId,
        });
        if (result.operation !== "deleteShelf")
            throw this.#unexpected(result.operation);
    }

    async listChangelists(
        repositoryId: RepositoryId,
    ): Promise<readonly GitChangelist[]> {
        const result = await this.#repositoryService({
            operation: "listChangelists",
            repositoryId,
        });
        if (result.operation !== "listChangelists")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async saveChangelist(
        repositoryId: RepositoryId,
        id: string | null,
        name: string,
        paths: readonly string[],
    ): Promise<GitChangelist> {
        const result = await this.#repositoryService({
            operation: "saveChangelist",
            repositoryId,
            id,
            name,
            paths,
        });
        if (result.operation !== "saveChangelist")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async deleteChangelist(
        repositoryId: RepositoryId,
        changelistId: string,
    ): Promise<void> {
        const result = await this.#repositoryService({
            operation: "deleteChangelist",
            repositoryId,
            changelistId,
        });
        if (result.operation !== "deleteChangelist")
            throw this.#unexpected(result.operation);
    }

    async commitChangelist(
        repositoryId: RepositoryId,
        changelistId: string,
        message: string,
        amend: boolean,
        signOff: boolean,
        gpgSign: boolean,
    ): Promise<GitChangelistCommitResult> {
        const result = await this.#repositoryService({
            operation: "commitChangelist",
            repositoryId,
            changelistId,
            message,
            amend,
            signOff,
            gpgSign,
        });
        if (result.operation !== "commitChangelist")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async listRecoveryEntries(
        repositoryId: RepositoryId,
    ): Promise<readonly GitRecoveryEntry[]> {
        const result = await this.#repositoryService({
            operation: "listRecoveryEntries",
            repositoryId,
        });
        if (result.operation !== "listRecoveryEntries")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async restoreRecoveryEntry(
        repositoryId: RepositoryId,
        entryId: string,
    ): Promise<GitRecoveryRestoreResult> {
        const result = await this.#repositoryService({
            operation: "restoreRecoveryEntry",
            repositoryId,
            entryId,
        });
        if (result.operation !== "restoreRecoveryEntry")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async listConflicts(
        repositoryId: RepositoryId,
    ): Promise<readonly GitConflictFile[]> {
        const result = await this.#repositoryService({
            operation: "listConflicts",
            repositoryId,
        });
        if (result.operation !== "listConflicts")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async readConflict(
        repositoryId: RepositoryId,
        path: string,
    ): Promise<GitConflictContent> {
        const result = await this.#repositoryService({
            operation: "readConflict",
            repositoryId,
            path,
        });
        if (result.operation !== "readConflict")
            throw this.#unexpected(result.operation);
        return result.value;
    }

    async writeConflictResult(
        repositoryId: RepositoryId,
        path: string,
        conflictResult: string,
        stage: boolean,
    ): Promise<void> {
        const result = await this.#repositoryService({
            operation: "writeConflictResult",
            repositoryId,
            path,
            result: conflictResult,
            stage,
        });
        if (result.operation !== "writeConflictResult")
            throw this.#unexpected(result.operation);
    }

    async resolveBinaryConflict(
        repositoryId: RepositoryId,
        path: string,
        side: "ours" | "theirs",
    ): Promise<void> {
        const result = await this.#repositoryService({
            operation: "resolveBinaryConflict",
            repositoryId,
            path,
            side,
        });
        if (result.operation !== "resolveBinaryConflict")
            throw this.#unexpected(result.operation);
    }

    async readFile(
        repositoryId: RepositoryId,
        source: FileSource,
        path: string,
    ): Promise<FileContent> {
        this.#assertReady();
        const request = GitReadFileRequestSchema.parse({
            repositoryId,
            source,
            path,
        });
        const response = await this.#request(
            { kind: "readFile", correlationId: randomUUID(), request },
            "readFileResult",
        );
        if (response.kind !== "readFileResult")
            throw this.#unexpected(response.kind);
        return response.content;
    }

    async readFilePreview(
        repositoryId: RepositoryId,
        source: FileSource,
        path: string,
    ): Promise<FilePreview> {
        this.#assertReady();
        const request = GitReadFileRequestSchema.parse({
            repositoryId,
            source,
            path,
        });
        const response = await this.#request(
            { kind: "readFilePreview", correlationId: randomUUID(), request },
            "readFilePreviewResult",
        );
        if (response.kind !== "readFilePreviewResult")
            throw this.#unexpected(response.kind);
        return response.preview;
    }

    async writeWorkingTreeFile(
        repositoryId: RepositoryId,
        path: string,
        content: string,
    ): Promise<void> {
        this.#assertReady();
        const request = GitWriteWorkingTreeFileRequestSchema.parse({
            repositoryId,
            path,
            content,
        });
        const response = await this.#request(
            {
                kind: "writeWorkingTreeFile",
                correlationId: randomUUID(),
                request,
            },
            "writeWorkingTreeFileResult",
        );
        if (response.kind !== "writeWorkingTreeFileResult")
            throw this.#unexpected(response.kind);
    }

    async watchRepository(
        repositoryId: RepositoryId,
        listener: RepositoryChangedListener,
    ): Promise<void> {
        this.#assertReady();
        const id = RepositoryIdSchema.parse(repositoryId);
        if (this.#watchListeners.has(id)) {
            throw new GitUtilityTransportError(
                "invalidRequest",
                "Repository is already watched",
            );
        }
        this.#watchListeners.set(id, listener);
        try {
            const response = await this.#request(
                {
                    kind: "watchRepository",
                    correlationId: randomUUID(),
                    repositoryId: id,
                },
                "watchRepositoryResult",
            );
            if (response.kind !== "watchRepositoryResult")
                throw this.#unexpected(response.kind);
            if (response.repositoryId !== id) {
                throw new GitUtilityTransportError(
                    "protocolViolation",
                    "Watch repository result did not match its request",
                );
            }
        } catch (error) {
            if (this.#watchListeners.get(id) === listener)
                this.#watchListeners.delete(id);
            throw error;
        }
    }

    async unwatchRepository(repositoryId: RepositoryId): Promise<void> {
        this.#assertReady();
        const id = RepositoryIdSchema.parse(repositoryId);
        const response = await this.#request(
            {
                kind: "unwatchRepository",
                correlationId: randomUUID(),
                repositoryId: id,
            },
            "unwatchRepositoryResult",
        );
        if (response.kind !== "unwatchRepositoryResult")
            throw this.#unexpected(response.kind);
        if (response.repositoryId !== id) {
            throw new GitUtilityTransportError(
                "protocolViolation",
                "Unwatch repository result did not match its request",
            );
        }
        this.#watchListeners.delete(id);
    }

    executeQuery(
        untrustedRequest: unknown,
        listener: GitEventListener,
    ): Promise<GitTerminalEvent> {
        this.#assertReady();
        const request = GitExecutionRequestSchema.parse(untrustedRequest);
        const correlationId = randomUUID();
        const promise = new Promise<GitTerminalEvent>((resolve, reject) => {
            this.#pendingQueries.set(correlationId, {
                requestId: request.requestId,
                listener,
                resolve,
                reject,
                phase: "awaitingStarted",
                nextSequence: 0,
            });
        });
        try {
            this.#send({ kind: "query", correlationId, request });
        } catch (error) {
            this.#pendingQueries.delete(correlationId);
            throw error;
        }
        return promise;
    }

    #executeCreation(
        message: Extract<
            MainToGitUtilityMessage,
            Readonly<{ kind: "initializeRepository" | "cloneRepository" }>
        >,
        requestId: string,
        operation: GitCreationOperation,
        listener: GitCreationEventListener,
    ): Promise<GitCreationTerminalEvent> {
        const promise = new Promise<GitCreationTerminalEvent>(
            (resolve, reject) => {
                this.#pendingCreations.set(message.correlationId, {
                    requestId,
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

    async #repositoryService(
        untrustedRequest: unknown,
    ): Promise<GitRepositoryServiceResult> {
        this.#assertReady();
        const request =
            GitRepositoryServiceRequestSchema.parse(untrustedRequest);
        const response = await this.#request(
            { kind: "repositoryService", correlationId: randomUUID(), request },
            "repositoryServiceResult",
        );
        if (response.kind !== "repositoryServiceResult")
            throw this.#unexpected(response.kind);
        if (response.result.operation !== request.operation) {
            throw new GitUtilityTransportError(
                "protocolViolation",
                "Repository service result did not match its request",
            );
        }
        return response.result;
    }

    async cancelQuery(requestId: string): Promise<boolean> {
        this.#assertReady();
        const id = GitRequestIdSchema.parse(requestId);
        const response = await this.#request(
            { kind: "cancel", correlationId: randomUUID(), requestId: id },
            "cancelResult",
        );
        if (response.kind !== "cancelResult")
            throw this.#unexpected(response.kind);
        return response.cancelled;
    }

    dispose(): Promise<void> {
        if (this.#disposePromise !== null) return this.#disposePromise;
        if (this.#state === "disposed" || this.#state === "crashed")
            return Promise.resolve();
        this.#assertReady();
        const responsePromise = this.#request(
            { kind: "dispose", correlationId: randomUUID() },
            "disposeResult",
        );
        this.#state = "disposing";
        this.#disposePromise = responsePromise
            .then((response) => {
                if (response.kind !== "disposeResult")
                    throw this.#unexpected(response.kind);
                this.#state = "disposed";
                this.#clearHandshakeTimer();
                const error = new GitUtilityTransportError(
                    "disposed",
                    "Git utility client was disposed",
                );
                this.#rejectOutstanding(error);
                this.#cleanUpSubscriptions();
                this.#transport.kill();
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

    get state(): ClientState {
        return this.#state;
    }

    #request(
        message: MainToGitUtilityMessage,
        expectedKind: PendingCommand["expectedKind"],
    ): Promise<GitUtilityToMainMessage> {
        this.#assertReady();
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
                case "openRepositoryResult":
                case "closeRepositoryResult":
                case "inspectSnapshotResult":
                case "repositoryServiceResult":
                case "cancelResult":
                case "readFileResult":
                case "readFilePreviewResult":
                case "writeWorkingTreeFileResult":
                case "watchRepositoryResult":
                case "unwatchRepositoryResult":
                case "disposeResult":
                    this.#commandResult(message);
                    return;
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
        this.#resolveHandshake();
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
        const listener = this.#watchListeners.get(event.repositoryId);
        if (listener === undefined) return;
        try {
            listener(event);
        } catch {
            // Consumer exceptions do not compromise watcher cleanup or later invalidations.
        }
    }

    #commandResult(
        message: Extract<
            GitUtilityToMainMessage,
            Readonly<{
                kind:
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
            }>
        >,
    ): void {
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
        if (correlationId === null) {
            this.#crash(error);
            return;
        }
        if (
            correlationId === this.#handshakeCorrelationId &&
            this.#state === "connecting"
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
        this.#transport.postMessage(
            MainToGitUtilityMessageSchema.parse(message),
        );
    }

    #assertReady(): void {
        if (this.#state !== "ready") {
            throw new GitUtilityTransportError(
                this.#state === "disposed" ? "disposed" : "protocolViolation",
                `Git utility client is ${this.#state}`,
            );
        }
    }

    #unexpected(kind: string): GitUtilityTransportError {
        return new GitUtilityTransportError(
            "protocolViolation",
            `Unexpected Git utility response: ${kind}`,
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
