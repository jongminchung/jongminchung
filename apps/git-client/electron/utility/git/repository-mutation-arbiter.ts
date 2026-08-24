type ReleaseLock = () => void;

interface MutationWaiter {
  readonly signal: AbortSignal;
  readonly resolve: (release: ReleaseLock) => void;
  readonly reject: (error: RepositoryMutationCancelledError) => void;
  readonly onAbort: () => void;
}

interface RepositoryLock {
  held: boolean;
  readonly waiters: MutationWaiter[];
}

function compareRepositoryIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export class RepositoryMutationCancelledError extends Error {
  readonly reason: unknown;

  constructor(reason: unknown) {
    super("Repository mutation was cancelled while waiting for ownership");
    this.name = "RepositoryMutationCancelledError";
    this.reason = reason;
  }
}

export class RepositoryMutationArbiter {
  readonly #locks = new Map<string, RepositoryLock>();

  async run<T>(
    repositoryIds: readonly string[],
    signal: AbortSignal,
    mutation: () => Promise<T>,
  ): Promise<T> {
    const ids = [...new Set(repositoryIds)].sort(compareRepositoryIds);
    const releases: ReleaseLock[] = [];
    try {
      for (const id of ids) {
        releases.push(await this.#acquire(id, signal));
      }
      if (signal.aborted)
        throw new RepositoryMutationCancelledError(signal.reason);
      return await mutation();
    } finally {
      for (const release of releases.toReversed()) release();
    }
  }

  #acquire(repositoryId: string, signal: AbortSignal): Promise<ReleaseLock> {
    if (signal.aborted) {
      return Promise.reject(
        new RepositoryMutationCancelledError(signal.reason),
      );
    }
    const existing = this.#locks.get(repositoryId);
    if (existing === undefined) {
      const lock: RepositoryLock = { held: true, waiters: [] };
      this.#locks.set(repositoryId, lock);
      return Promise.resolve(this.#releaseOnce(repositoryId, lock));
    }
    if (!existing.held) {
      existing.held = true;
      return Promise.resolve(this.#releaseOnce(repositoryId, existing));
    }
    return new Promise<ReleaseLock>((resolve, reject) => {
      const waiter: MutationWaiter = {
        signal,
        resolve,
        reject,
        onAbort: () => this.#cancelWaiter(repositoryId, existing, waiter),
      };
      existing.waiters.push(waiter);
      signal.addEventListener("abort", waiter.onAbort, { once: true });
    });
  }

  #cancelWaiter(
    repositoryId: string,
    lock: RepositoryLock,
    waiter: MutationWaiter,
  ): void {
    const index = lock.waiters.indexOf(waiter);
    if (index < 0) return;
    lock.waiters.splice(index, 1);
    waiter.signal.removeEventListener("abort", waiter.onAbort);
    waiter.reject(new RepositoryMutationCancelledError(waiter.signal.reason));
    if (!lock.held && lock.waiters.length === 0)
      this.#locks.delete(repositoryId);
  }

  #releaseOnce(repositoryId: string, lock: RepositoryLock): ReleaseLock {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      lock.held = false;
      this.#advance(repositoryId, lock);
    };
  }

  #advance(repositoryId: string, lock: RepositoryLock): void {
    for (;;) {
      const waiter = lock.waiters.shift();
      if (waiter === undefined) {
        this.#locks.delete(repositoryId);
        return;
      }
      waiter.signal.removeEventListener("abort", waiter.onAbort);
      if (waiter.signal.aborted) {
        waiter.reject(
          new RepositoryMutationCancelledError(waiter.signal.reason),
        );
        continue;
      }
      lock.held = true;
      waiter.resolve(this.#releaseOnce(repositoryId, lock));
      return;
    }
  }
}
