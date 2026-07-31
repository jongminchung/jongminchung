import { describe, expect, it } from "vitest";
import {
  RepositoryMutationArbiter,
  RepositoryMutationCancelledError,
} from "./repository-mutation-arbiter";

interface Deferred {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
}

function deferred(): Deferred {
  let resolvePromise: (() => void) | null = null;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });
  return {
    promise,
    resolve: () => {
      if (resolvePromise === null) throw new Error("Deferred promise is unavailable");
      resolvePromise();
    },
  };
}

describe("RepositoryMutationArbiter", () => {
  it("serializes writes to the same repository", async () => {
    const arbiter = new RepositoryMutationArbiter();
    const firstStarted = deferred();
    const releaseFirst = deferred();
    const order: string[] = [];

    const first = arbiter.run(["repository"], new AbortController().signal, async () => {
      order.push("first:start");
      firstStarted.resolve();
      await releaseFirst.promise;
      order.push("first:end");
    });
    await firstStarted.promise;
    const second = arbiter.run(["repository"], new AbortController().signal, async () => {
      order.push("second");
    });
    await Promise.resolve();

    expect(order).toEqual(["first:start"]);
    releaseFirst.resolve();
    await Promise.all([first, second]);
    expect(order).toEqual(["first:start", "first:end", "second"]);
  });

  it("allows writes to different repositories to run in parallel", async () => {
    const arbiter = new RepositoryMutationArbiter();
    const release = deferred();
    const started: string[] = [];

    const first = arbiter.run(["first"], new AbortController().signal, async () => {
      started.push("first");
      await release.promise;
    });
    const second = arbiter.run(["second"], new AbortController().signal, async () => {
      started.push("second");
      await release.promise;
    });
    await Promise.resolve();

    expect(started).toEqual(["first", "second"]);
    release.resolve();
    await Promise.all([first, second]);
  });

  it("removes a cancelled waiter without running its mutation", async () => {
    const arbiter = new RepositoryMutationArbiter();
    const firstStarted = deferred();
    const releaseFirst = deferred();
    const first = arbiter.run(["repository"], new AbortController().signal, async () => {
      firstStarted.resolve();
      await releaseFirst.promise;
    });
    await firstStarted.promise;

    const cancellation = new AbortController();
    let secondStarted = false;
    const second = arbiter.run(["repository"], cancellation.signal, async () => {
      secondStarted = true;
    });
    cancellation.abort("repositoryClosed");

    await expect(second).rejects.toMatchObject({
      name: "RepositoryMutationCancelledError",
      reason: "repositoryClosed",
    } satisfies Partial<RepositoryMutationCancelledError>);
    expect(secondStarted).toBe(false);

    releaseFirst.resolve();
    await first;
    await expect(
      arbiter.run(["repository"], new AbortController().signal, async () => "available"),
    ).resolves.toBe("available");
  });

  it("sorts multi-repository ownership before waiting to avoid lock-order deadlocks", async () => {
    const arbiter = new RepositoryMutationArbiter();
    const firstStarted = deferred();
    const releaseFirst = deferred();
    const first = arbiter.run(["a"], new AbortController().signal, async () => {
      firstStarted.resolve();
      await releaseFirst.promise;
    });
    await firstStarted.promise;

    let multiStarted = false;
    const multi = arbiter.run(["b", "a"], new AbortController().signal, async () => {
      multiStarted = true;
    });
    let repositoryBStarted = false;
    const repositoryB = arbiter.run(["b"], new AbortController().signal, async () => {
      repositoryBStarted = true;
    });
    await Promise.resolve();

    expect(repositoryBStarted).toBe(true);
    expect(multiStarted).toBe(false);
    await repositoryB;
    releaseFirst.resolve();
    await Promise.all([first, multi]);
    expect(multiStarted).toBe(true);
  });
});
