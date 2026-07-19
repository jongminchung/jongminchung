import { z } from "zod";
import type { CloneOptions } from "../../../src/generated/CloneOptions";
import {
  GIT_OUTPUT_LIMIT_BYTES,
  GIT_QUERY_TIMEOUT_MS,
} from "../../../src/shared/contracts/git-utility";
import { displayGitCommand, type GitProcessOutcome } from "./git-process";
import { redactCredentials, safeErrorMessage } from "./redaction";
import {
  RepositoryCreateProcessRunner,
  type RepositoryCreateProcessRunnerLike,
} from "./repository-create-process";
import { RepositoryCreateTarget } from "./repository-create-target";
import { validateRevision } from "./validation";

export interface InitializeRepositoryRequest {
  readonly path: string;
  readonly bare: boolean;
  readonly initialBranch?: string | null;
}

export interface CloneRepositoryRequest {
  readonly url: string;
  readonly path: string;
  readonly options: CloneOptions;
  readonly singleBranch: boolean;
}

export const InitializeRepositoryRequestSchema = z
  .object({
    path: z.string().min(1).max(16_384),
    bare: z.boolean(),
    initialBranch: z.string().min(1).max(512).nullable().optional(),
  })
  .strict()
  .readonly();

export const CloneRepositoryRequestSchema = z
  .object({
    url: z.string().min(1).max(16_384),
    path: z.string().min(1).max(16_384),
    options: z
      .object({
        depth: z.number().int().min(1).max(65_535).nullable(),
        branch: z.string().min(1).max(512).nullable(),
        recurseSubmodules: z.boolean(),
      })
      .strict(),
    singleBranch: z.boolean(),
  })
  .strict()
  .readonly();

export type RepositoryCreateOperation = "initialize" | "clone";

export interface RepositoryCreateStartedEvent {
  readonly kind: "started";
  readonly operation: RepositoryCreateOperation;
  readonly displayCommand: string;
  readonly startedAtMs: number;
}

export interface RepositoryCreateOutputEvent {
  readonly kind: "output";
  readonly operation: RepositoryCreateOperation;
  readonly sequence: number;
  readonly stream: "stdout" | "stderr";
  readonly data: string;
}

export interface RepositoryCreateProgressEvent {
  readonly kind: "progress";
  readonly operation: "clone";
  readonly sequence: number;
  readonly phase: string;
  readonly percent: number;
  readonly current: number;
  readonly total: number;
}

export interface RepositoryCreateCompletedEvent {
  readonly kind: "completed";
  readonly operation: RepositoryCreateOperation;
  readonly path: string;
  readonly exitCode: number;
  readonly durationMs: number;
}

export interface RepositoryCreateFailedEvent {
  readonly kind: "failed";
  readonly operation: RepositoryCreateOperation;
  readonly code: "invalidInput" | "commandFailed" | "gitUnavailable" | "outputLimit";
  readonly message: string;
  readonly exitCode: number | null;
  readonly durationMs: number;
}

export interface RepositoryCreateCancelledEvent {
  readonly kind: "cancelled";
  readonly operation: RepositoryCreateOperation;
  readonly reason: "requested" | "timeout";
  readonly durationMs: number;
}

export type RepositoryCreateEvent =
  | RepositoryCreateStartedEvent
  | RepositoryCreateOutputEvent
  | RepositoryCreateProgressEvent
  | RepositoryCreateCompletedEvent
  | RepositoryCreateFailedEvent
  | RepositoryCreateCancelledEvent;

export type RepositoryCreateTerminalEvent = Extract<
  RepositoryCreateEvent,
  Readonly<{ kind: "completed" | "failed" | "cancelled" }>
>;

export type RepositoryCreateListener = (event: RepositoryCreateEvent) => void;

function validateCloneUrl(url: string): void {
  let hasControlCharacter = false;
  for (let index = 0; index < url.length; index += 1) {
    const codeUnit = url.charCodeAt(index);
    if (codeUnit > 0x1f && codeUnit !== 0x7f) continue;
    hasControlCharacter = true;
    break;
  }
  if (url.startsWith("-") || hasControlCharacter) {
    throw new Error("Clone URL contains an unsafe character");
  }
}

function parseProgress(
  data: string,
): readonly Omit<RepositoryCreateProgressEvent, "kind" | "operation" | "sequence">[] {
  const matches: Omit<RepositoryCreateProgressEvent, "kind" | "operation" | "sequence">[] = [];
  const pattern = /(?:^|[\r\n])(?:remote:\s*)?([^:\r\n]+):\s+(\d+)%\s+\((\d+)\/(\d+)\)/gu;
  for (const match of data.matchAll(pattern)) {
    const phase = match[1]?.trim();
    const percent = Number(match[2]);
    const current = Number(match[3]);
    const total = Number(match[4]);
    if (
      !phase ||
      !Number.isSafeInteger(percent) ||
      percent < 0 ||
      percent > 100 ||
      !Number.isSafeInteger(current) ||
      current < 0 ||
      !Number.isSafeInteger(total) ||
      total < 0 ||
      current > total
    )
      continue;
    matches.push({ phase, percent, current, total });
  }
  return matches;
}

function terminalEvent(
  operation: RepositoryCreateOperation,
  path: string,
  outcome: GitProcessOutcome,
): RepositoryCreateTerminalEvent {
  if (outcome.kind === "completed") {
    return {
      kind: "completed",
      operation,
      path,
      exitCode: outcome.exitCode,
      durationMs: outcome.durationMs,
    };
  }
  if (outcome.kind === "cancelled") {
    return {
      kind: "cancelled",
      operation,
      reason: outcome.reason === "timeout" ? "timeout" : "requested",
      durationMs: outcome.durationMs,
    };
  }
  return {
    kind: "failed",
    operation,
    code:
      outcome.code === "spawnFailed" ||
      outcome.code === "unsupportedGit" ||
      outcome.code === "notRepository" ||
      outcome.code === "repositoryNotOpen"
        ? "commandFailed"
        : outcome.code,
    message: safeErrorMessage(outcome.message),
    exitCode: outcome.exitCode,
    durationMs: outcome.durationMs,
  };
}

export class RepositoryCreateService {
  readonly #runner: RepositoryCreateProcessRunnerLike;

  private constructor(runner: RepositoryCreateProcessRunnerLike) {
    this.#runner = runner;
  }

  static create(): RepositoryCreateService {
    return new RepositoryCreateService(RepositoryCreateProcessRunner.create());
  }

  static of(runner: RepositoryCreateProcessRunnerLike): RepositoryCreateService {
    return new RepositoryCreateService(runner);
  }

  async initialize(
    untrustedRequest: unknown,
    listener: RepositoryCreateListener,
    signal?: AbortSignal,
  ): Promise<RepositoryCreateTerminalEvent> {
    const startedAt = performance.now();
    let request: InitializeRepositoryRequest;
    let target: RepositoryCreateTarget;
    try {
      request = InitializeRepositoryRequestSchema.parse(untrustedRequest);
      if (request.initialBranch !== null && request.initialBranch !== undefined) {
        validateRevision(request.initialBranch);
      }
      target = await RepositoryCreateTarget.prepare(request.path, "initialize");
    } catch (error) {
      const event: RepositoryCreateFailedEvent = {
        kind: "failed",
        operation: "initialize",
        code: "invalidInput",
        message: safeErrorMessage(
          error instanceof Error ? error.message : "Invalid repository path",
        ),
        exitCode: null,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      };
      this.#emit(listener, event);
      return event;
    }

    const initialBranch = request.initialBranch ?? (request.bare ? null : "main");
    const args = [
      "init",
      ...(request.bare ? ["--bare"] : []),
      ...(initialBranch === null ? [] : [`--initial-branch=${initialBranch}`]),
      "--",
      target.processPath,
    ];
    const displayArgs = [...args.slice(0, -1), target.finalPath];
    this.#emit(listener, {
      kind: "started",
      operation: "initialize",
      displayCommand: displayGitCommand(displayArgs),
      startedAtMs: Date.now(),
    });
    let sequence = 0;
    const outcome = await this.#runner.run(
      {
        args,
        timeoutMs: GIT_QUERY_TIMEOUT_MS,
        outputLimitBytes: GIT_OUTPUT_LIMIT_BYTES,
      },
      (output) => {
        const data = target.display(redactCredentials(output.data));
        this.#emit(listener, {
          kind: "output",
          operation: "initialize",
          sequence,
          stream: output.stream,
          data,
        });
        sequence += 1;
      },
      signal,
    );
    const terminal = await this.#finalizeTarget("initialize", target, outcome);
    this.#emit(listener, terminal);
    return terminal;
  }

  async clone(
    untrustedRequest: unknown,
    listener: RepositoryCreateListener,
    signal?: AbortSignal,
  ): Promise<RepositoryCreateTerminalEvent> {
    const startedAt = performance.now();
    let request: CloneRepositoryRequest;
    let target: RepositoryCreateTarget;
    try {
      const parsed = CloneRepositoryRequestSchema.parse(untrustedRequest);
      request = parsed;
      validateCloneUrl(request.url);
      if (request.options.branch !== null) validateRevision(request.options.branch);
      target = await RepositoryCreateTarget.prepare(request.path, "clone");
    } catch (error) {
      const event: RepositoryCreateFailedEvent = {
        kind: "failed",
        operation: "clone",
        code: "invalidInput",
        message: safeErrorMessage(error instanceof Error ? error.message : "Invalid clone request"),
        exitCode: null,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      };
      this.#emit(listener, event);
      return event;
    }

    const args = [
      "clone",
      "--progress",
      "--origin",
      "origin",
      ...(request.options.depth === null ? [] : ["--depth", String(request.options.depth)]),
      ...(request.options.branch === null ? [] : ["--branch", request.options.branch]),
      ...(request.singleBranch ? ["--single-branch"] : []),
      ...(request.options.recurseSubmodules ? ["--recurse-submodules"] : []),
      "--",
      request.url,
      target.processPath,
    ];
    const displayArgs = [...args.slice(0, -1), target.finalPath];
    this.#emit(listener, {
      kind: "started",
      operation: "clone",
      displayCommand: displayGitCommand(displayArgs),
      startedAtMs: Date.now(),
    });
    let sequence = 0;
    const outcome = await this.#runner.run(
      {
        args,
        timeoutMs: 30 * 60 * 1_000,
        outputLimitBytes: GIT_OUTPUT_LIMIT_BYTES,
      },
      (output) => {
        const data = target.display(redactCredentials(output.data));
        this.#emit(listener, {
          kind: "output",
          operation: "clone",
          sequence,
          stream: output.stream,
          data,
        });
        sequence += 1;
        for (const progress of parseProgress(data)) {
          this.#emit(listener, {
            kind: "progress",
            operation: "clone",
            sequence,
            ...progress,
          });
          sequence += 1;
        }
      },
      signal,
    );
    const terminal = await this.#finalizeTarget("clone", target, outcome);
    this.#emit(listener, terminal);
    return terminal;
  }

  async #finalizeTarget(
    operation: RepositoryCreateOperation,
    target: RepositoryCreateTarget,
    outcome: GitProcessOutcome,
  ): Promise<RepositoryCreateTerminalEvent> {
    if (outcome.kind === "completed") {
      try {
        const committedPath = await target.commit();
        return terminalEvent(operation, committedPath, outcome);
      } catch (error) {
        await target.cleanUp();
        return {
          kind: "failed",
          operation,
          code: "commandFailed",
          message: safeErrorMessage(
            error instanceof Error ? error.message : "Unable to finalize repository target",
          ),
          exitCode: outcome.exitCode,
          durationMs: outcome.durationMs,
        };
      }
    }
    try {
      await target.cleanUp();
      return terminalEvent(operation, target.finalPath, outcome);
    } catch (error) {
      const original =
        outcome.kind === "failed"
          ? outcome.message
          : `Git command was cancelled (${outcome.reason})`;
      const cleanup =
        error instanceof Error ? error.message : "Unable to clean utility-owned staging directory";
      return {
        kind: "failed",
        operation,
        code: "commandFailed",
        message: safeErrorMessage(`${original}. ${cleanup}`),
        exitCode: outcome.kind === "failed" ? outcome.exitCode : null,
        durationMs: outcome.durationMs,
      };
    }
  }

  #emit(listener: RepositoryCreateListener, event: RepositoryCreateEvent): void {
    try {
      listener(event);
    } catch {
      // A UI listener must not prevent process cleanup or terminal event delivery.
    }
  }
}
