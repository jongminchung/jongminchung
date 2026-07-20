import { join } from "node:path";
import {
  GitOperationSchema,
  type ValidatedGitOperation,
} from "../../../src/shared/contracts/git-operation";
import {
  GIT_EVENT_CHUNK_CHARACTERS,
  GIT_OUTPUT_LIMIT_BYTES,
  GIT_QUERY_TIMEOUT_MS,
  type GitEventListener,
  type GitRequestEvent,
  type GitRequestId,
  type GitTerminalEvent,
  type RepositoryId,
} from "../../../src/shared/contracts/git-utility";
import { GitUtilityError, asGitUtilityError } from "./git-error";
import {
  displayGitCommand,
  type GitProcessOutcome,
  type GitProcessRunnerLike,
} from "./git-process";
import { buildOperationCommand } from "./operation-command";
import { safeErrorMessage } from "./redaction";
import type { RepositoryRegistry } from "./repository-registry";
import { SequenceEditorSession, type SequenceEditorMode } from "./sequence-editor";
import {
  createApplicationSequenceEditorCommand,
  createSequenceEditorCommand,
} from "./sequence-editor-cli";

export type SequenceEditorRuntime =
  | Readonly<{
      kind: "application";
      executablePath: string;
      applicationEntryPath: string | null;
    }>
  | Readonly<{
      kind: "standalone";
      executablePath: string;
      entryPath: string;
    }>;

interface ActiveOperation {
  readonly repositoryId: RepositoryId;
  readonly cancellation: AbortController;
}

export interface OperationRecoveryRecorder {
  recordBeforeOperation(
    repositoryId: RepositoryId,
    operation: ValidatedGitOperation,
    signal?: AbortSignal,
  ): Promise<unknown>;
}

function duration(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function defaultSequenceEditorRuntime(): SequenceEditorRuntime {
  return {
    kind: "application",
    executablePath: process.execPath,
    applicationEntryPath: process.defaultApp === true ? join(__dirname, "main.cjs") : null,
  };
}

function sequenceEditorCommand(
  runtime: SequenceEditorRuntime,
  mode: SequenceEditorMode,
  session: SequenceEditorSession,
): string {
  if (runtime.kind === "standalone") {
    return createSequenceEditorCommand({
      executablePath: runtime.executablePath,
      entryPath: runtime.entryPath,
      mode,
      session,
    });
  }
  return createApplicationSequenceEditorCommand({
    executablePath: runtime.executablePath,
    applicationEntryPath: runtime.applicationEntryPath,
    mode,
    session,
  });
}

export class GitOperationService {
  readonly #registry: RepositoryRegistry;
  readonly #runner: GitProcessRunnerLike;
  readonly #sequenceEditorRuntime: SequenceEditorRuntime;
  readonly #recovery: OperationRecoveryRecorder | null;
  readonly #active = new Map<GitRequestId, ActiveOperation>();

  constructor(
    registry: RepositoryRegistry,
    runner: GitProcessRunnerLike,
    sequenceEditorRuntime: SequenceEditorRuntime = defaultSequenceEditorRuntime(),
    recovery: OperationRecoveryRecorder | null = null,
  ) {
    this.#registry = registry;
    this.#runner = runner;
    this.#sequenceEditorRuntime = sequenceEditorRuntime;
    this.#recovery = recovery;
  }

  async execute(
    requestId: GitRequestId,
    repositoryId: RepositoryId,
    untrustedOperation: unknown,
    listener: GitEventListener,
  ): Promise<GitTerminalEvent> {
    if (this.#active.has(requestId)) {
      throw new GitUtilityError("invalidInput", `Request ${requestId} is already running`);
    }
    const startedAt = performance.now();
    let startedDelivered = false;
    let operation: ValidatedGitOperation | null = null;
    try {
      const parsed = GitOperationSchema.safeParse(untrustedOperation);
      if (!parsed.success) {
        throw new GitUtilityError(
          "invalidInput",
          parsed.error.issues[0]?.message ?? "Invalid Git operation",
        );
      }
      operation = parsed.data;
      const command = buildOperationCommand(operation);
      const cancellation = new AbortController();
      this.#active.set(requestId, { repositoryId, cancellation });
      this.#emit(listener, {
        kind: "started",
        requestId,
        displayCommand: displayGitCommand(command.args),
        startedAtMs: Date.now(),
      });
      startedDelivered = true;
      const repository = this.#registry.get(repositoryId);
      await this.#recovery?.recordBeforeOperation(repositoryId, operation, cancellation.signal);
      const outcome =
        command.kind === "sequence"
          ? await this.#runSequence(
              repository.path,
              repository.gitDirectory,
              operation,
              command.args,
              cancellation.signal,
            )
          : await this.#runner.run(
              {
                cwd: repository.path,
                args: command.args,
                stdin: command.stdin,
                timeoutMs: GIT_QUERY_TIMEOUT_MS,
                outputLimitBytes: GIT_OUTPUT_LIMIT_BYTES,
              },
              cancellation.signal,
            );
      let sequence = 0;
      for (const output of outcome.output) {
        for (let offset = 0; offset < output.data.length; offset += GIT_EVENT_CHUNK_CHARACTERS) {
          this.#emit(listener, {
            kind: "output",
            requestId,
            sequence,
            stream: output.stream,
            data: output.data.slice(offset, offset + GIT_EVENT_CHUNK_CHARACTERS),
          });
          sequence += 1;
        }
      }
      const terminal = this.#terminal(requestId, outcome);
      this.#emit(listener, terminal);
      return terminal;
    } catch (error) {
      if (!startedDelivered) {
        this.#emit(listener, {
          kind: "started",
          requestId,
          displayCommand: displayGitCommand([operation?.kind ?? "operation"]),
          startedAtMs: Date.now(),
        });
      }
      const failure = asGitUtilityError(error);
      const terminal: GitTerminalEvent = {
        kind: "failed",
        requestId,
        code: failure.code,
        message: safeErrorMessage(failure.message),
        exitCode: failure.exitCode,
        durationMs: duration(startedAt),
      };
      this.#emit(listener, terminal);
      return terminal;
    } finally {
      this.#active.delete(requestId);
    }
  }

  cancel(requestId: GitRequestId): boolean {
    const active = this.#active.get(requestId);
    if (active === undefined) return false;
    active.cancellation.abort("requested");
    return true;
  }

  cancelRepository(repositoryId: RepositoryId): number {
    let count = 0;
    for (const active of this.#active.values()) {
      if (active.repositoryId !== repositoryId) continue;
      active.cancellation.abort("repositoryClosed");
      count += 1;
    }
    return count;
  }

  get activeCount(): number {
    return this.#active.size;
  }

  async #runSequence(
    repositoryPath: string,
    gitDirectory: string,
    operation: ValidatedGitOperation,
    args: readonly string[],
    signal: AbortSignal,
  ): Promise<GitProcessOutcome> {
    const session = await SequenceEditorSession.create(gitDirectory, operation, signal);
    try {
      return await this.#runner.run(
        {
          cwd: repositoryPath,
          args,
          timeoutMs: GIT_QUERY_TIMEOUT_MS,
          outputLimitBytes: GIT_OUTPUT_LIMIT_BYTES,
          editorEnvironment: {
            sequenceEditor: sequenceEditorCommand(this.#sequenceEditorRuntime, "sequence", session),
            messageEditor: sequenceEditorCommand(this.#sequenceEditorRuntime, "message", session),
          },
        },
        signal,
      );
    } finally {
      await session.cleanup();
    }
  }

  #terminal(requestId: GitRequestId, outcome: GitProcessOutcome): GitTerminalEvent {
    if (outcome.kind === "completed") {
      return {
        kind: "completed",
        requestId,
        exitCode: outcome.exitCode,
        durationMs: outcome.durationMs,
      };
    }
    if (outcome.kind === "cancelled") {
      return {
        kind: "cancelled",
        requestId,
        reason: outcome.reason,
        durationMs: outcome.durationMs,
      };
    }
    return {
      kind: "failed",
      requestId,
      code: outcome.code,
      message: safeErrorMessage(outcome.message),
      exitCode: outcome.exitCode,
      durationMs: outcome.durationMs,
    };
  }

  #emit(listener: GitEventListener, event: GitRequestEvent): void {
    try {
      listener(event);
    } catch {
      // Consumer errors must not break operation cleanup or terminal delivery.
    }
  }
}
