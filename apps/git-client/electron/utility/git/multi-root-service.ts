import { realpath, stat } from "node:fs/promises";
import { z } from "zod";
import {
  GitOperationSchema,
  type ValidatedGitOperation,
} from "../../../src/shared/contracts/git-operation";
import {
  GIT_QUERY_TIMEOUT_MS,
  RepositoryIdSchema,
  type GitMultiRootOutcome as MultiRootOutcome,
  type GitMultiRootResult as MultiRootResult,
  type GitMultiRootRollbackStep as MultiRootRollbackStep,
  type RepositoryId,
  type RepositoryRecord,
} from "../../../src/shared/contracts/git-utility";
import { GitUtilityError } from "./git-error";
import { GitProcessRunner, type GitProcessOutcome, type GitProcessRunnerLike } from "./git-process";
import { buildOperationCommand } from "./operation-command";
import { safeErrorMessage } from "./redaction";
import type { RepositoryRegistry } from "./repository-registry";

type SynchronizedOperation =
  | Extract<ValidatedGitOperation, { readonly kind: "checkout" }>
  | Extract<ValidatedGitOperation, { readonly kind: "createBranch" }>;

type RollbackOperation =
  | Extract<ValidatedGitOperation, { readonly kind: "checkout" }>
  | Extract<ValidatedGitOperation, { readonly kind: "deleteBranch" }>;

type CancellationReason = "requested" | "repositoryClosed" | "timeout";

interface RepositoryIdentity {
  readonly canonicalPath: string;
  readonly device: number;
  readonly inode: number;
}

interface TimedSignal {
  readonly signal: AbortSignal;
  dispose(): void;
}

interface SuccessfulExecution {
  readonly kind: "succeeded";
  readonly outcome: MultiRootOutcome;
  readonly rollback: MultiRootRollbackStep | null;
}

interface FailedExecution {
  readonly kind: "failed";
  readonly outcome: MultiRootOutcome;
}

type RepositoryExecution = SuccessfulExecution | FailedExecution;

export interface MultiRootRecoveryRecorder {
  recordBeforeOperation(
    repositoryId: RepositoryId,
    operation: ValidatedGitOperation,
    signal?: AbortSignal,
  ): Promise<unknown>;
}

export interface MultiRootServiceOptions {
  readonly timeoutMs?: number;
}

const RollbackStepSchema = z
  .object({
    repositoryId: RepositoryIdSchema,
    path: z
      .string()
      .min(1)
      .max(16_384)
      .refine((value) => !value.includes("\0"), "Path must not contain a null byte"),
    description: z
      .string()
      .min(1)
      .max(4_096)
      .refine((value) => !value.includes("\0"), "Description must not contain a null byte"),
    operations: z.array(GitOperationSchema).min(1).max(2),
  })
  .strict();

class MultiRootCancellationError extends Error {
  readonly reason: CancellationReason;

  constructor(reason: CancellationReason) {
    super(`Git operation was cancelled (${reason})`);
    this.name = "MultiRootCancellationError";
    this.reason = reason;
  }
}

function invalid(message: string): GitUtilityError {
  return new GitUtilityError("invalidInput", message);
}

function cancellationReason(signal: AbortSignal | undefined): CancellationReason {
  if (signal?.reason === "repositoryClosed") return "repositoryClosed";
  if (signal?.reason === "timeout") return "timeout";
  return "requested";
}

function assertNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) throw new MultiRootCancellationError(cancellationReason(signal));
}

function createTimedSignal(parent: AbortSignal | undefined, timeoutMs: number): TimedSignal {
  const controller = new AbortController();
  const onAbort = (): void => {
    if (!controller.signal.aborted) controller.abort(parent?.reason ?? "requested");
  };
  if (parent?.aborted === true) onAbort();
  else parent?.addEventListener("abort", onAbort, { once: true });
  const timeout = setTimeout(() => {
    if (!controller.signal.aborted) controller.abort("timeout");
  }, timeoutMs);
  timeout.unref();
  return {
    signal: controller.signal,
    dispose(): void {
      clearTimeout(timeout);
      parent?.removeEventListener("abort", onAbort);
    },
  };
}

function waitForSignal<T>(operation: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (signal === undefined) return operation;
  if (signal.aborted)
    return Promise.reject(new MultiRootCancellationError(cancellationReason(signal)));
  return new Promise((resolve, reject) => {
    let settled = false;
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      reject(new MultiRootCancellationError(cancellationReason(signal)));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    void (async (): Promise<void> => {
      try {
        const value = await operation;
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      } catch (error) {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    })();
  });
}

class RepositoryMutex {
  readonly #tails = new Map<RepositoryId, Promise<void>>();

  async run<T>(
    repositoryId: RepositoryId,
    signal: AbortSignal | undefined,
    operation: () => Promise<T>,
  ): Promise<T> {
    const previous = this.#tails.get(repositoryId) ?? Promise.resolve();
    let release = (): void => undefined;
    const current = new Promise<void>((resolveCurrent) => {
      release = resolveCurrent;
    });
    const tail = (async (): Promise<void> => {
      await previous;
      await current;
    })();
    this.#tails.set(repositoryId, tail);
    void this.#removeCompleted(repositoryId, tail);
    try {
      await waitForSignal(previous, signal);
      assertNotAborted(signal);
      return await operation();
    } finally {
      release();
    }
  }

  async #removeCompleted(repositoryId: RepositoryId, tail: Promise<void>): Promise<void> {
    await tail;
    if (this.#tails.get(repositoryId) === tail) this.#tails.delete(repositoryId);
  }
}

function validateSynchronizedOperation(untrustedOperation: unknown): SynchronizedOperation {
  const parsed = GitOperationSchema.safeParse(untrustedOperation);
  if (!parsed.success) {
    throw invalid(parsed.error.issues[0]?.message ?? "Invalid Git operation");
  }
  const operation = parsed.data;
  if (operation.kind === "checkout" && !operation.force) return operation;
  if (operation.kind === "createBranch" && operation.checkout) return operation;
  throw invalid(
    "Only non-forced checkout and create-and-checkout branch operations can be synchronized",
  );
}

function validateRollbackOperation(operation: ValidatedGitOperation): RollbackOperation {
  if (operation.kind === "checkout" && !operation.force) return operation;
  if (operation.kind === "deleteBranch" && !operation.force) return operation;
  throw invalid("Rollback contains an operation that is not a non-forced checkout or delete");
}

function validateRollbackSteps(untrustedSteps: unknown): readonly MultiRootRollbackStep[] {
  const parsed = z.array(RollbackStepSchema).max(10_000).safeParse(untrustedSteps);
  if (!parsed.success) {
    throw invalid(parsed.error.issues[0]?.message ?? "Invalid multi-root rollback plan");
  }
  const seen = new Set<RepositoryId>();
  return parsed.data.map((step) => {
    if (seen.has(step.repositoryId)) {
      throw invalid("Rollback plan must not contain duplicate repository ids");
    }
    seen.add(step.repositoryId);
    const operations: RollbackOperation[] = step.operations.map((operation) =>
      validateRollbackOperation(operation),
    );
    return {
      repositoryId: step.repositoryId,
      path: step.path,
      description: step.description,
      operations,
    };
  });
}

function normalizeRepositoryIds(untrustedIds: readonly RepositoryId[]): readonly RepositoryId[] {
  if (untrustedIds.length === 0) throw invalid("Repository ids must not be empty");
  const ids = untrustedIds.map((id) => {
    const parsed = RepositoryIdSchema.safeParse(id);
    if (!parsed.success) throw invalid("Repository id must be a UUID");
    return parsed.data;
  });
  return [...new Set(ids)].sort((left, right) => left.localeCompare(right, "en"));
}

async function pinRepository(record: RepositoryRecord): Promise<RepositoryIdentity> {
  let canonicalPath: string;
  try {
    canonicalPath = await realpath(record.path);
    const metadata = await stat(canonicalPath);
    if (!metadata.isDirectory()) throw new Error("Repository path is not a directory");
    if (canonicalPath !== record.path) {
      throw new Error("Repository registry path is no longer canonical");
    }
    return {
      canonicalPath,
      device: metadata.dev,
      inode: metadata.ino,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Repository path is inaccessible";
    throw new GitUtilityError("commandFailed", safeErrorMessage(detail));
  }
}

async function assertRepositoryIdentity(
  record: RepositoryRecord,
  expected: RepositoryIdentity,
): Promise<void> {
  const current = await pinRepository(record);
  if (
    current.canonicalPath !== expected.canonicalPath ||
    current.device !== expected.device ||
    current.inode !== expected.inode
  ) {
    throw new GitUtilityError("commandFailed", "Repository path identity changed during operation");
  }
}

async function validateRollbackPath(
  record: RepositoryRecord,
  untrustedPath: string,
): Promise<void> {
  let suppliedPath: string;
  try {
    suppliedPath = await realpath(untrustedPath);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Rollback path is inaccessible";
    throw invalid(safeErrorMessage(detail));
  }
  if (suppliedPath !== record.path) {
    throw invalid("Rollback path does not identify the registered repository");
  }
  await pinRepository(record);
}

function outcomeMessage(
  outcome: Exclude<GitProcessOutcome, { readonly kind: "completed" }>,
  signal: AbortSignal,
): string {
  if (outcome.kind === "cancelled") {
    const reason = signal.aborted ? cancellationReason(signal) : outcome.reason;
    return safeErrorMessage(`Git operation was cancelled (${reason})`);
  }
  return safeErrorMessage(outcome.message);
}

function errorMessage(error: unknown): string {
  if (error instanceof MultiRootCancellationError) return safeErrorMessage(error.message);
  if (error instanceof Error) return safeErrorMessage(error.message);
  return "Git operation failed";
}

function failureOutcome(record: RepositoryRecord, message: string): MultiRootOutcome {
  return {
    repositoryId: record.id,
    path: record.path,
    succeeded: false,
    message: safeErrorMessage(message),
  };
}

function successfulOutcome(record: RepositoryRecord, message: string): MultiRootOutcome {
  return {
    repositoryId: record.id,
    path: record.path,
    succeeded: true,
    message,
  };
}

function rollbackForOperation(
  record: RepositoryRecord,
  operation: SynchronizedOperation,
  previousBranch: string | null,
  previousHead: string | null,
): MultiRootRollbackStep | null {
  const target = previousBranch ?? previousHead;
  if (target === null) return null;
  const operations: RollbackOperation[] = [{ kind: "checkout", target, force: false }];
  let description = `check out ${target}`;
  if (operation.kind === "createBranch") {
    operations.push({
      kind: "deleteBranch",
      name: operation.name,
      force: false,
    });
    description = `check out ${target}, then delete ${operation.name}`;
  }
  return {
    repositoryId: record.id,
    path: record.path,
    description,
    operations,
  };
}

export class MultiRootService {
  readonly #registry: RepositoryRegistry;
  readonly #recovery: MultiRootRecoveryRecorder;
  readonly #runner: GitProcessRunnerLike;
  readonly #timeoutMs: number;
  readonly #mutex = new RepositoryMutex();

  private constructor(
    registry: RepositoryRegistry,
    recovery: MultiRootRecoveryRecorder,
    runner: GitProcessRunnerLike,
    timeoutMs: number,
  ) {
    this.#registry = registry;
    this.#recovery = recovery;
    this.#runner = runner;
    this.#timeoutMs = timeoutMs;
  }

  static of(
    registry: RepositoryRegistry,
    recovery: MultiRootRecoveryRecorder,
    runner: GitProcessRunnerLike = new GitProcessRunner(),
    options: MultiRootServiceOptions = {},
  ): MultiRootService {
    const timeoutMs = options.timeoutMs ?? GIT_QUERY_TIMEOUT_MS;
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
      throw invalid("Multi-root timeout must be a positive integer");
    }
    return new MultiRootService(registry, recovery, runner, timeoutMs);
  }

  async executeSynchronizedBranchOperation(
    repositoryIds: readonly RepositoryId[],
    untrustedOperation: unknown,
    signal?: AbortSignal,
  ): Promise<MultiRootResult> {
    const operation = validateSynchronizedOperation(untrustedOperation);
    const ids = normalizeRepositoryIds(repositoryIds);
    const records = ids.map((id) => this.#registry.get(id));
    await Promise.all(
      records.map(async (record, index) => {
        if (record.id !== ids[index]) throw invalid("Repository registry identity mismatch");
        await pinRepository(record);
      }),
    );

    const outcomes: MultiRootOutcome[] = [];
    const rollbackPlan: MultiRootRollbackStep[] = [];
    for (const record of records) {
      let execution: RepositoryExecution;
      try {
        execution = await this.#mutex.run(record.id, signal, async () =>
          this.#executeOne(record, operation, signal),
        );
      } catch (error) {
        outcomes.push(failureOutcome(record, errorMessage(error)));
        break;
      }
      outcomes.push(execution.outcome);
      if (execution.kind === "failed") break;
      if (execution.rollback !== null) rollbackPlan.unshift(execution.rollback);
    }
    return { outcomes, rollbackPlan };
  }

  async applyMultiRootRollback(
    untrustedSteps: unknown,
    signal?: AbortSignal,
  ): Promise<readonly MultiRootOutcome[]> {
    const steps = validateRollbackSteps(untrustedSteps);
    const prepared = await Promise.all(
      steps.map(async (step) => {
        const record = this.#registry.get(step.repositoryId);
        if (record.id !== step.repositoryId) throw invalid("Repository registry identity mismatch");
        await validateRollbackPath(record, step.path);
        return { record, step };
      }),
    );
    const outcomes: MultiRootOutcome[] = [];
    for (const { record, step } of prepared) {
      try {
        const outcome = await this.#mutex.run(record.id, signal, async () =>
          this.#rollbackOne(record, step.operations, signal),
        );
        outcomes.push(outcome);
      } catch (error) {
        outcomes.push(failureOutcome(record, errorMessage(error)));
      }
    }
    return outcomes;
  }

  async #executeOne(
    record: RepositoryRecord,
    operation: SynchronizedOperation,
    parentSignal: AbortSignal | undefined,
  ): Promise<RepositoryExecution> {
    const timed = createTimedSignal(parentSignal, this.#timeoutMs);
    try {
      assertNotAborted(timed.signal);
      const identity = await pinRepository(record);
      const previousBranch = await this.#optional(
        record.path,
        ["symbolic-ref", "--quiet", "--short", "HEAD"],
        timed.signal,
      );
      const previousHead = await this.#optional(
        record.path,
        ["rev-parse", "--verify", "HEAD"],
        timed.signal,
      );
      const command = buildOperationCommand(operation);
      if (command.kind !== "process") {
        throw new Error("Synchronized operation unexpectedly requires a sequence editor");
      }
      await assertRepositoryIdentity(record, identity);
      assertNotAborted(timed.signal);
      await waitForSignal(
        this.#recovery.recordBeforeOperation(record.id, operation, timed.signal),
        timed.signal,
      );
      assertNotAborted(timed.signal);
      await assertRepositoryIdentity(record, identity);
      const outcome = await this.#runner.run(
        {
          cwd: record.path,
          args: command.args,
          stdin: command.stdin,
          redactStdout: true,
          timeoutMs: this.#timeoutMs,
        },
        timed.signal,
      );
      if (outcome.kind !== "completed") {
        return {
          kind: "failed",
          outcome: failureOutcome(record, outcomeMessage(outcome, timed.signal)),
        };
      }
      return {
        kind: "succeeded",
        outcome: successfulOutcome(record, "completed"),
        rollback: rollbackForOperation(record, operation, previousBranch, previousHead),
      };
    } catch (error) {
      return {
        kind: "failed",
        outcome: failureOutcome(record, errorMessage(error)),
      };
    } finally {
      timed.dispose();
    }
  }

  async #rollbackOne(
    record: RepositoryRecord,
    operations: readonly RollbackOperation[],
    parentSignal: AbortSignal | undefined,
  ): Promise<MultiRootOutcome> {
    const timed = createTimedSignal(parentSignal, this.#timeoutMs);
    try {
      assertNotAborted(timed.signal);
      const identity = await pinRepository(record);
      for (const untrustedOperation of operations) {
        const parsed = GitOperationSchema.safeParse(untrustedOperation);
        if (!parsed.success) throw invalid("Rollback operation is invalid");
        const operation = validateRollbackOperation(parsed.data);
        const command = buildOperationCommand(operation);
        if (command.kind !== "process") {
          throw new Error("Rollback operation unexpectedly requires a sequence editor");
        }
        await assertRepositoryIdentity(record, identity);
        assertNotAborted(timed.signal);
        await waitForSignal(
          this.#recovery.recordBeforeOperation(record.id, operation, timed.signal),
          timed.signal,
        );
        assertNotAborted(timed.signal);
        await assertRepositoryIdentity(record, identity);
        const outcome = await this.#runner.run(
          {
            cwd: record.path,
            args: command.args,
            stdin: command.stdin,
            redactStdout: true,
            timeoutMs: this.#timeoutMs,
          },
          timed.signal,
        );
        if (outcome.kind !== "completed") {
          return failureOutcome(record, outcomeMessage(outcome, timed.signal));
        }
      }
      return successfulOutcome(record, "rollback completed");
    } catch (error) {
      return failureOutcome(record, errorMessage(error));
    } finally {
      timed.dispose();
    }
  }

  async #optional(
    cwd: string,
    args: readonly string[],
    signal: AbortSignal,
  ): Promise<string | null> {
    const outcome = await this.#runner.run(
      { cwd, args, redactStdout: true, timeoutMs: this.#timeoutMs },
      signal,
    );
    if (outcome.kind === "cancelled") {
      throw new MultiRootCancellationError(
        signal.aborted ? cancellationReason(signal) : outcome.reason,
      );
    }
    if (outcome.kind === "failed") return null;
    const value = outcome.output
      .filter((entry) => entry.stream === "stdout")
      .map((entry) => entry.data)
      .join("")
      .trim();
    return value || null;
  }
}
