import {
  GitDomainQueryRequestSchema,
  type GitDomainQueryRequest,
} from "../../../src/shared/contracts/git-request";
import {
  GIT_EVENT_CHUNK_CHARACTERS,
  GitQueryRequestSchema,
  type GitEventListener,
  type GitFailureCode,
  type GitQueryRequest,
  type GitRequestEvent,
  type GitRequestId,
  type GitTerminalEvent,
  type RepositoryId,
} from "../../../src/shared/contracts/git-utility";
import { GitUtilityError, asGitUtilityError } from "./git-error";
import {
  displayGitCommand,
  type GitCancellationReason,
  type GitProcessRunnerLike,
} from "./git-process";
import { safeErrorMessage } from "./redaction";
import { RepositoryQueryService, type RepositoryQueryOutcome } from "./repository-query-service";
import type { RepositoryRegistry } from "./repository-registry";
import { buildRequestArguments } from "./request-query";

interface ActiveQuery {
  readonly repositoryId: RepositoryId;
  readonly cancellation: AbortController;
}

function domainRequest(request: GitQueryRequest): GitDomainQueryRequest {
  const { requestId: _requestId, ...domain } = request;
  return GitDomainQueryRequestSchema.parse(domain);
}

export function buildQueryArguments(request: GitQueryRequest): readonly string[] {
  return buildRequestArguments(domainRequest(request));
}

function duration(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function unexpectedFailure(
  requestId: GitRequestId,
  startedAt: number,
  error: unknown,
): GitTerminalEvent {
  const failure = asGitUtilityError(error);
  return {
    kind: "failed",
    requestId,
    code: failure.code,
    message: safeErrorMessage(failure.message),
    exitCode: failure.exitCode,
    durationMs: duration(startedAt),
  };
}

export class GitQueryService {
  readonly #queries: RepositoryQueryService;
  readonly #active = new Map<GitRequestId, ActiveQuery>();

  constructor(registry: RepositoryRegistry, runner: GitProcessRunnerLike) {
    this.#queries = RepositoryQueryService.of(registry, runner);
  }

  async execute(untrustedRequest: unknown, listener: GitEventListener): Promise<GitTerminalEvent> {
    const request = this.#parseRequest(untrustedRequest);
    if (this.#active.has(request.requestId)) {
      throw new GitUtilityError("invalidInput", `Request ${request.requestId} is already running`);
    }

    const startedAt = performance.now();
    const requestBody = domainRequest(request);
    let args: readonly string[];
    try {
      args = buildRequestArguments(requestBody);
    } catch {
      args = [request.kind];
    }
    const cancellation = new AbortController();
    this.#active.set(request.requestId, {
      repositoryId: request.repositoryId,
      cancellation,
    });
    try {
      this.#emit(listener, {
        kind: "started",
        requestId: request.requestId,
        displayCommand: displayGitCommand(args),
        startedAtMs: Date.now(),
      });
      const outcome = await this.#queries.execute(requestBody, cancellation.signal);
      this.#emitOutput(listener, request.requestId, outcome);
      const terminal = this.#terminalEvent(request.requestId, outcome);
      this.#emit(listener, terminal);
      return terminal;
    } catch (error) {
      const terminal = unexpectedFailure(request.requestId, startedAt, error);
      this.#emit(listener, terminal);
      return terminal;
    } finally {
      this.#active.delete(request.requestId);
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

  #parseRequest(value: unknown): GitQueryRequest {
    const result = GitQueryRequestSchema.safeParse(value);
    if (result.success) return result.data;
    throw new GitUtilityError(
      "invalidInput",
      result.error.issues[0]?.message ?? "Invalid Git query",
    );
  }

  #emitOutput(
    listener: GitEventListener,
    requestId: GitRequestId,
    outcome: RepositoryQueryOutcome,
  ): void {
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
  }

  #terminalEvent(requestId: GitRequestId, outcome: RepositoryQueryOutcome): GitTerminalEvent {
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
      message: outcome.message,
      exitCode: outcome.exitCode,
      durationMs: outcome.durationMs,
    };
  }

  #emit(listener: GitEventListener, event: GitRequestEvent): void {
    try {
      listener(event);
    } catch {
      // A renderer listener must not break process cleanup or terminal event delivery.
    }
  }
}

export type { GitCancellationReason, GitFailureCode };
