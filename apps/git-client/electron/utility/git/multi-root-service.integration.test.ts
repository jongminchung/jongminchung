import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ValidatedGitOperation } from "../../../src/shared/contracts/git-operation";
import type { GitMultiRootRollbackStep as MultiRootRollbackStep } from "../../../src/shared/contracts/git-utility";
import type {
  RepositoryId,
  RepositoryRecord,
} from "../../../src/shared/contracts/git-utility";
import {
  GitProcessRunner,
  type GitProcessOutcome,
  type GitProcessRunnerLike,
  type GitProcessSpec,
} from "./git-process";
import {
  MultiRootService,
  type MultiRootRecoveryRecorder,
} from "./multi-root-service";
import { RepositoryRegistry } from "./repository-registry";

const temporaryDirectories: string[] = [];
const GIT_ENVIRONMENT = Object.freeze({
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_OPTIONAL_LOCKS: "0",
  GIT_PAGER: "cat",
  LC_ALL: "C",
});

interface RepositoryFixture {
  readonly root: string;
  readonly record: RepositoryRecord;
}

interface RepositoryState {
  readonly branch: string;
  readonly branches: string;
  readonly head: string;
  readonly status: string;
}

function git(cwd: string, ...args: readonly string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    env: GIT_ENVIRONMENT,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0)
    throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

function state(root: string): RepositoryState {
  return {
    branch: git(root, "symbolic-ref", "--short", "HEAD"),
    branches: git(
      root,
      "for-each-ref",
      "--format=%(refname):%(objectname)",
      "refs/heads",
    ),
    head: git(root, "rev-parse", "HEAD"),
    status: git(root, "status", "--porcelain=v2", "--branch"),
  };
}

async function createRepositories(count: number): Promise<{
  readonly fixtures: readonly RepositoryFixture[];
  readonly registry: RepositoryRegistry;
}> {
  const parent = await mkdtemp(join(tmpdir(), "git-client-multi-root-"));
  temporaryDirectories.push(parent);
  const runner = new GitProcessRunner();
  const registry = new RepositoryRegistry(runner);
  const fixtures: RepositoryFixture[] = [];
  for (let index = 0; index < count; index += 1) {
    const root = join(parent, `repository-${index}`);
    await mkdir(root);
    git(root, "init", "--initial-branch=main");
    git(root, "config", "user.name", "Multi Root Test");
    git(root, "config", "user.email", "multi-root@example.invalid");
    await writeFile(join(root, "tracked.txt"), `repository ${index}\n`, "utf8");
    git(root, "add", "--", "tracked.txt");
    git(root, "commit", "-m", "initial");
    fixtures.push({ root, record: await registry.open(root) });
  }
  return { fixtures, registry };
}

function isMutation(spec: GitProcessSpec): boolean {
  return ["branch", "checkout", "switch"].includes(spec.args[0] ?? "");
}

class RecordingRecovery implements MultiRootRecoveryRecorder {
  readonly calls: Array<{
    readonly repositoryId: RepositoryId;
    readonly operation: ValidatedGitOperation;
  }> = [];
  readonly #events: string[] | null;
  readonly #failure: Error | null;

  constructor(events: string[] | null = null, failure: Error | null = null) {
    this.#events = events;
    this.#failure = failure;
  }

  recordBeforeOperation(
    repositoryId: RepositoryId,
    operation: ValidatedGitOperation,
    signal?: AbortSignal,
  ): Promise<unknown> {
    if (signal?.aborted === true)
      return Promise.reject(new Error("recovery cancelled"));
    this.calls.push({ repositoryId, operation });
    this.#events?.push(`recovery:${repositoryId}:${operation.kind}`);
    if (this.#failure !== null) return Promise.reject(this.#failure);
    return Promise.resolve(null);
  }
}

class EventRunner implements GitProcessRunnerLike {
  readonly #delegate = new GitProcessRunner();
  readonly #events: string[];
  readonly #records: ReadonlyMap<string, RepositoryId>;

  constructor(events: string[], records: readonly RepositoryRecord[]) {
    this.#events = events;
    this.#records = new Map(records.map((record) => [record.path, record.id]));
  }

  async run(
    spec: GitProcessSpec,
    signal?: AbortSignal,
  ): Promise<GitProcessOutcome> {
    if (isMutation(spec)) {
      this.#events.push(
        `mutation:${this.#records.get(spec.cwd ?? "") ?? "unknown"}:${spec.args[0]}`,
      );
    }
    return this.#delegate.run(spec, signal);
  }
}

class MutationGateRunner implements GitProcessRunnerLike {
  readonly #delegate = new GitProcessRunner();
  readonly #firstStarted: () => void;
  readonly #firstGate: Promise<void>;
  mutationCount = 0;
  activeMutations = 0;
  maximumActiveMutations = 0;

  constructor(firstStarted: () => void, firstGate: Promise<void>) {
    this.#firstStarted = firstStarted;
    this.#firstGate = firstGate;
  }

  async run(
    spec: GitProcessSpec,
    signal?: AbortSignal,
  ): Promise<GitProcessOutcome> {
    if (!isMutation(spec)) return this.#delegate.run(spec, signal);
    this.mutationCount += 1;
    this.activeMutations += 1;
    this.maximumActiveMutations = Math.max(
      this.maximumActiveMutations,
      this.activeMutations,
    );
    try {
      if (this.mutationCount === 1) {
        this.#firstStarted();
        await this.#firstGate;
      }
      return await this.#delegate.run(spec, signal);
    } finally {
      this.activeMutations -= 1;
    }
  }
}

class NeverSettlingRecovery implements MultiRootRecoveryRecorder {
  recordBeforeOperation(
    _repositoryId: RepositoryId,
    _operation: ValidatedGitOperation,
    _signal?: AbortSignal,
  ): Promise<unknown> {
    return new Promise(() => undefined);
  }
}

class CallbackRecovery implements MultiRootRecoveryRecorder {
  readonly #callback: () => Promise<void>;

  constructor(callback: () => Promise<void>) {
    this.#callback = callback;
  }

  async recordBeforeOperation(
    _repositoryId: RepositoryId,
    _operation: ValidatedGitOperation,
    _signal?: AbortSignal,
  ): Promise<unknown> {
    await this.#callback();
    return null;
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("멀티루트서비스", () => {
  it("[성공] 결정적으로 중요한 순간을 말하고 모두 분기 상태를 복원함", async () => {
    const { fixtures, registry } = await createRepositories(2);
    const records = fixtures.map((fixture) => fixture.record);
    const sorted = [...records].sort((left, right) =>
      left.id.localeCompare(right.id, "en"),
    );
    const before = new Map(
      fixtures.map((fixture) => [fixture.record.id, state(fixture.root)]),
    );
    const events: string[] = [];
    const recovery = new RecordingRecovery(events);
    const service = MultiRootService.of(
      registry,
      recovery,
      new EventRunner(events, records),
    );

    const result = await service.executeSynchronizedBranchOperation(
      [records[1]?.id ?? "", records[0]?.id ?? "", records[1]?.id ?? ""],
      {
        kind: "createBranch",
        name: "feat/sync",
        startPoint: "HEAD",
        checkout: true,
      },
    );

    expect(result.outcomes.map((outcome) => outcome.repositoryId)).toEqual(
      sorted.map((record) => record.id),
    );
    expect(result.outcomes.every((outcome) => outcome.succeeded)).toBe(true);
    expect(result.rollbackPlan.map((step) => step.repositoryId)).toEqual(
      [...sorted].reverse().map((record) => record.id),
    );
    expect(
      result.rollbackPlan.every((step) => step.operations.length === 2),
    ).toBe(true);
    expect(recovery.calls).toHaveLength(2);
    expect(events).toEqual(
      sorted.flatMap((record) => [
        `recovery:${record.id}:createBranch`,
        `mutation:${record.id}:switch`,
      ]),
    );
    for (const fixture of fixtures) {
      expect(git(fixture.root, "branch", "--show-current")).toBe("feat/sync");
    }

    const rollbackOutcomes = await service.applyMultiRootRollback(
      result.rollbackPlan,
    );

    expect(rollbackOutcomes.every((outcome) => outcome.succeeded)).toBe(true);
    expect(recovery.calls).toHaveLength(6);
    for (const fixture of fixtures) {
      expect(state(fixture.root)).toEqual(before.get(fixture.record.id));
    }
  });

  it("[성공] 첫 번째 실패자들에서 종료하고 이전 성공에 대해서만 롤백을 반환함", async () => {
    const { fixtures, registry } = await createRepositories(3);
    const sorted = [...fixtures].sort((left, right) =>
      left.record.id.localeCompare(right.record.id, "en"),
    );
    const middle = sorted[1];
    if (middle === undefined) throw new Error("middle fixture is missing");
    git(middle.root, "branch", "feat/sync");
    const recovery = new RecordingRecovery();
    const service = MultiRootService.of(registry, recovery);

    const result = await service.executeSynchronizedBranchOperation(
      fixtures.map((fixture) => fixture.record.id).reverse(),
      {
        kind: "createBranch",
        name: "feat/sync",
        startPoint: "HEAD",
        checkout: true,
      },
    );

    expect(result.outcomes).toHaveLength(2);
    expect(result.outcomes[0]).toMatchObject({
      repositoryId: sorted[0]?.record.id,
      succeeded: true,
    });
    expect(result.outcomes[1]).toMatchObject({
      repositoryId: middle.record.id,
      succeeded: false,
    });
    expect(result.rollbackPlan).toHaveLength(1);
    expect(result.rollbackPlan[0]?.repositoryId).toBe(sorted[0]?.record.id);
    expect(git(sorted[0]?.root ?? "", "branch", "--show-current")).toBe(
      "feat/sync",
    );
    expect(git(sorted[2]?.root ?? "", "branch", "--show-current")).toBe("main");

    await expect(
      service.applyMultiRootRollback(result.rollbackPlan),
    ).resolves.toMatchObject([{ succeeded: true }]);
    expect(git(sorted[0]?.root ?? "", "branch", "--show-current")).toBe("main");
  });

  it("[실패] 이전에 변형되지 않은 채로 작업되지 않은 상태", async () => {
    const { fixtures, registry } = await createRepositories(1);
    const fixture = fixtures[0];
    if (fixture === undefined) throw new Error("fixture is missing");
    const before = state(fixture.root);
    const recovery = new RecordingRecovery();
    const service = MultiRootService.of(registry, recovery);

    await expect(
      service.executeSynchronizedBranchOperation([fixture.record.id], {
        kind: "checkout",
        target: "main",
        force: true,
      }),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(
      service.executeSynchronizedBranchOperation([fixture.record.id], {
        kind: "createBranch",
        name: "unsafe",
        startPoint: "HEAD",
        checkout: false,
      }),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(
      service.executeSynchronizedBranchOperation([fixture.record.id], {
        kind: "checkout",
        target: "main",
        force: false,
        extra: true,
      }),
    ).rejects.toMatchObject({ code: "invalidInput" });
    expect(recovery.calls).toHaveLength(0);
    expect(state(fixture.root)).toEqual(before);
  });

  it("[실패] 수리 기록이 실패할 때 변형을 방지하고 증명을 수정함", async () => {
    const { fixtures, registry } = await createRepositories(1);
    const fixture = fixtures[0];
    if (fixture === undefined) throw new Error("fixture is missing");
    const before = state(fixture.root);
    const recovery = new RecordingRecovery(
      null,
      new Error(
        "https://alice:super-secret@example.invalid token=ghp_12345678901234567890",
      ),
    );
    const service = MultiRootService.of(registry, recovery);

    const result = await service.executeSynchronizedBranchOperation(
      [fixture.record.id],
      {
        kind: "createBranch",
        name: "feat/blocked",
        startPoint: "HEAD",
        checkout: true,
      },
    );

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]).toMatchObject({ succeeded: false });
    expect(result.outcomes[0]?.message).toContain("[redacted]");
    expect(result.outcomes[0]?.message).not.toContain("alice");
    expect(result.outcomes[0]?.message).not.toContain("super-secret");
    expect(result.rollbackPlan).toEqual([]);
    expect(state(fixture.root)).toEqual(before);
  });

  it("[실패] 변경하지 않고 취소하고 복구 시간을 초과할 수 없습니다", async () => {
    const { fixtures, registry } = await createRepositories(1);
    const fixture = fixtures[0];
    if (fixture === undefined) throw new Error("fixture is missing");
    git(fixture.root, "branch", "topic");
    const before = state(fixture.root);
    const cancelled = new AbortController();
    cancelled.abort("requested");
    const recovery = new RecordingRecovery();
    const service = MultiRootService.of(registry, recovery);

    const cancelledResult = await service.executeSynchronizedBranchOperation(
      [fixture.record.id],
      { kind: "checkout", target: "topic", force: false },
      cancelled.signal,
    );

    expect(cancelledResult.outcomes[0]).toMatchObject({
      succeeded: false,
      message: expect.stringContaining("requested"),
    });
    expect(recovery.calls).toHaveLength(0);
    expect(state(fixture.root)).toEqual(before);

    const timeoutService = MultiRootService.of(
      registry,
      new NeverSettlingRecovery(),
      new GitProcessRunner(),
      { timeoutMs: 25 },
    );
    const timeoutResult =
      await timeoutService.executeSynchronizedBranchOperation(
        [fixture.record.id],
        { kind: "checkout", target: "topic", force: false },
      );
    expect(timeoutResult.outcomes[0]).toMatchObject({
      succeeded: false,
      message: expect.stringContaining("timeout"),
    });
    expect(state(fixture.root)).toEqual(before);
  });

  it("[성공] 계획을 적용하기 전에는 외부 ID 및 허용된 작업을 검증함", async () => {
    const { fixtures, registry } = await createRepositories(2);
    const first = fixtures[0];
    const second = fixtures[1];
    if (first === undefined || second === undefined)
      throw new Error("fixtures are missing");
    const service = MultiRootService.of(registry, new RecordingRecovery());
    const result = await service.executeSynchronizedBranchOperation(
      [first.record.id],
      {
        kind: "createBranch",
        name: "feat/rollback",
        startPoint: "HEAD",
        checkout: true,
      },
    );
    const step = result.rollbackPlan[0];
    if (step === undefined) throw new Error("rollback step is missing");
    const wrongPath: MultiRootRollbackStep = { ...step, path: second.root };

    await expect(
      service.applyMultiRootRollback([wrongPath]),
    ).rejects.toMatchObject({
      code: "invalidInput",
    });
    await expect(
      service.applyMultiRootRollback([
        {
          ...step,
          operations: [{ kind: "checkout", target: "main", force: true }],
        },
      ]),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(
      service.applyMultiRootRollback([step, step]),
    ).rejects.toMatchObject({
      code: "invalidInput",
    });
    expect(git(first.root, "branch", "--show-current")).toBe("feat/rollback");

    await expect(service.applyMultiRootRollback([step])).resolves.toMatchObject(
      [{ succeeded: true }],
    );
    expect(git(first.root, "branch", "--show-current")).toBe("main");
  });

  it("[성공] 복구 후 스티커를 교체하고 교체하지 않음", async () => {
    const { fixtures, registry } = await createRepositories(1);
    const fixture = fixtures[0];
    if (fixture === undefined) throw new Error("fixture is missing");
    const moved = `${fixture.root}-moved`;
    const recovery = new CallbackRecovery(async () => {
      await rename(fixture.root, moved);
      await mkdir(fixture.root);
      git(fixture.root, "init", "--initial-branch=main");
      git(fixture.root, "config", "user.name", "Replacement Test");
      git(fixture.root, "config", "user.email", "replacement@example.invalid");
      await writeFile(
        join(fixture.root, "replacement.txt"),
        "replacement\n",
        "utf8",
      );
      git(fixture.root, "add", "--", "replacement.txt");
      git(fixture.root, "commit", "-m", "replacement");
    });
    const service = MultiRootService.of(registry, recovery);

    const result = await service.executeSynchronizedBranchOperation(
      [fixture.record.id],
      {
        kind: "createBranch",
        name: "feat/race",
        startPoint: "HEAD",
        checkout: true,
      },
    );

    expect(result.outcomes[0]).toMatchObject({
      succeeded: false,
      message: expect.stringContaining("identity changed"),
    });
    expect(result.rollbackPlan).toEqual([]);
    expect(git(fixture.root, "branch", "--show-current")).toBe("main");
    expect(git(fixture.root, "branch", "--list", "feat/race")).toBe("");
    expect(git(moved, "branch", "--show-current")).toBe("main");
  });

  it("[실패] 교착상태 없이 모임에 대한 모임을 직렬화함", async () => {
    const { fixtures, registry } = await createRepositories(1);
    const fixture = fixtures[0];
    if (fixture === undefined) throw new Error("fixture is missing");
    git(fixture.root, "branch", "topic-a");
    git(fixture.root, "branch", "topic-b");
    let signalFirstStarted = (): void => undefined;
    const firstStarted = new Promise<void>((resolve) => {
      signalFirstStarted = resolve;
    });
    let releaseFirst = (): void => undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const runner = new MutationGateRunner(signalFirstStarted, firstGate);
    const service = MultiRootService.of(
      registry,
      new RecordingRecovery(),
      runner,
    );

    const first = service.executeSynchronizedBranchOperation(
      [fixture.record.id],
      {
        kind: "checkout",
        target: "topic-a",
        force: false,
      },
    );
    await firstStarted;
    const second = service.executeSynchronizedBranchOperation(
      [fixture.record.id],
      {
        kind: "checkout",
        target: "topic-b",
        force: false,
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(runner.mutationCount).toBe(1);
    releaseFirst();

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult.outcomes[0]).toMatchObject({ succeeded: true });
    expect(secondResult.outcomes[0]).toMatchObject({ succeeded: true });
    expect(firstResult.rollbackPlan[0]?.operations).toEqual([
      { kind: "checkout", target: "main", force: false },
    ]);
    expect(secondResult.rollbackPlan[0]?.operations).toEqual([
      { kind: "checkout", target: "topic-a", force: false },
    ]);
    expect(runner.maximumActiveMutations).toBe(1);
    expect(git(fixture.root, "branch", "--show-current")).toBe("topic-b");

    await service.applyMultiRootRollback(secondResult.rollbackPlan);
    expect(git(fixture.root, "branch", "--show-current")).toBe("topic-a");
    await service.applyMultiRootRollback(firstResult.rollbackPlan);
    expect(git(fixture.root, "branch", "--show-current")).toBe("main");
  });
});
