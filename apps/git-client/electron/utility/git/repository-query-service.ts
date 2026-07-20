import {
  GitDomainQueryRequestSchema,
  type GitDomainQueryRequest,
} from "../../../src/shared/contracts/git-request";
import {
  GIT_OUTPUT_LIMIT_BYTES,
  GIT_QUERY_TIMEOUT_MS,
  type GitFailureCode,
  type GitOutputStream,
} from "../../../src/shared/contracts/git-utility";
import { asGitUtilityError } from "./git-error";
import {
  GitProcessRunner,
  type GitCancellationReason,
  type GitProcessOutcome,
  type GitProcessRunnerLike,
} from "./git-process";
import { redactCredentialChunks, safeErrorMessage } from "./redaction";
import type { RepositoryRegistry } from "./repository-registry";
import { buildRequestArguments } from "./request-query";

export type RepositoryQueryKind = GitDomainQueryRequest["kind"];

interface RepositoryQueryOutput {
  readonly queryKind: RepositoryQueryKind;
  readonly output: readonly RepositoryQueryStream[];
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
}

export interface RepositoryQueryStream {
  readonly stream: GitOutputStream;
  readonly data: string;
}

export interface RepositoryQueryCompleted extends RepositoryQueryOutput {
  readonly kind: "completed";
  readonly exitCode: number;
}

export interface RepositoryQueryFailed {
  readonly kind: "failed";
  readonly queryKind: RepositoryQueryKind | null;
  readonly code: GitFailureCode;
  readonly message: string;
  readonly exitCode: number | null;
  readonly output: readonly RepositoryQueryStream[];
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
}

export interface RepositoryQueryCancelled extends RepositoryQueryOutput {
  readonly kind: "cancelled";
  readonly reason: GitCancellationReason;
}

export type RepositoryQueryOutcome =
  | RepositoryQueryCompleted
  | RepositoryQueryFailed
  | RepositoryQueryCancelled;

function duration(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function decodedOutput(
  outcome: GitProcessOutcome,
  redactStdout: boolean,
): readonly RepositoryQueryStream[] {
  const output = outcome.output.map(({ stream, data }) => ({ stream, data }));
  for (const stream of ["stdout", "stderr"] as const) {
    if (stream === "stdout" && !redactStdout) continue;
    const indexes = output
      .map((entry, index) => (entry.stream === stream ? index : -1))
      .filter((index) => index >= 0);
    const redacted = redactCredentialChunks(indexes.map((index) => output[index]?.data ?? ""));
    indexes.forEach((index, streamIndex) => {
      const entry = output[index];
      if (entry !== undefined) entry.data = redacted[streamIndex] ?? "";
    });
  }
  return output;
}

export class RepositoryQueryService {
  readonly #registry: RepositoryRegistry;
  readonly #runner: GitProcessRunnerLike;

  private constructor(registry: RepositoryRegistry, runner: GitProcessRunnerLike) {
    this.#registry = registry;
    this.#runner = runner;
  }

  static of(
    registry: RepositoryRegistry,
    runner: GitProcessRunnerLike = new GitProcessRunner(),
  ): RepositoryQueryService {
    return new RepositoryQueryService(registry, runner);
  }

  async execute(untrustedRequest: unknown, signal?: AbortSignal): Promise<RepositoryQueryOutcome> {
    const startedAt = performance.now();
    const parsed = GitDomainQueryRequestSchema.safeParse(untrustedRequest);
    if (!parsed.success) {
      return {
        kind: "failed",
        queryKind: null,
        code: "invalidInput",
        message: safeErrorMessage(parsed.error.issues[0]?.message ?? "Invalid Git query"),
        exitCode: null,
        output: [],
        stdout: "",
        stderr: "",
        durationMs: duration(startedAt),
      };
    }

    const request = parsed.data;
    let args: readonly string[];
    let cwd: string;
    try {
      args = buildRequestArguments(request);
      cwd = this.#registry.get(request.repositoryId).path;
    } catch (error) {
      const failure = asGitUtilityError(error);
      return {
        kind: "failed",
        queryKind: request.kind,
        code: failure.code,
        message: safeErrorMessage(failure.message),
        exitCode: failure.exitCode,
        output: [],
        stdout: "",
        stderr: "",
        durationMs: duration(startedAt),
      };
    }

    let outcome: GitProcessOutcome;
    const redactStdout = request.kind === "configList";
    try {
      outcome = await this.#runner.run(
        {
          cwd,
          args,
          redactStdout,
          timeoutMs: GIT_QUERY_TIMEOUT_MS,
          outputLimitBytes: GIT_OUTPUT_LIMIT_BYTES,
        },
        signal,
      );
    } catch (error) {
      const failure = asGitUtilityError(error);
      return {
        kind: "failed",
        queryKind: request.kind,
        code: failure.code,
        message: safeErrorMessage(failure.message),
        exitCode: failure.exitCode,
        output: [],
        stdout: "",
        stderr: "",
        durationMs: duration(startedAt),
      };
    }

    const output = decodedOutput(outcome, redactStdout);
    const stdout = output
      .filter((entry) => entry.stream === "stdout")
      .map((entry) => entry.data)
      .join("");
    const stderr = output
      .filter((entry) => entry.stream === "stderr")
      .map((entry) => entry.data)
      .join("");
    if (outcome.kind === "completed") {
      return {
        kind: "completed",
        queryKind: request.kind,
        exitCode: outcome.exitCode,
        output,
        stdout,
        stderr,
        durationMs: outcome.durationMs,
      };
    }
    if (
      request.kind === "searchText" &&
      outcome.kind === "failed" &&
      outcome.code === "commandFailed" &&
      outcome.exitCode === 1
    ) {
      return {
        kind: "completed",
        queryKind: request.kind,
        exitCode: 0,
        output,
        stdout,
        stderr,
        durationMs: outcome.durationMs,
      };
    }
    if (outcome.kind === "cancelled") {
      return {
        kind: "cancelled",
        queryKind: request.kind,
        reason: outcome.reason,
        output,
        stdout,
        stderr,
        durationMs: outcome.durationMs,
      };
    }
    return {
      kind: "failed",
      queryKind: request.kind,
      code: outcome.code,
      message: safeErrorMessage(outcome.message),
      exitCode: outcome.exitCode,
      output,
      stdout,
      stderr,
      durationMs: outcome.durationMs,
    };
  }
}
