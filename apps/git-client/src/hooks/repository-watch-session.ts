export type RepositoryWatchSubscription = () => Promise<void>;

interface PendingWatch {
  readonly token: object;
  readonly promise: Promise<void>;
}

/**
 * Owns renderer-side watch registration state without treating a pending
 * subscription as a successful watch.
 */
export class RepositoryWatchSession {
  readonly #watched = new Set<string>();
  readonly #pending = new Map<string, PendingWatch>();

  ensure(repositoryId: string, subscribe: RepositoryWatchSubscription): Promise<void> {
    if (this.#watched.has(repositoryId)) return Promise.resolve();
    const pending = this.#pending.get(repositoryId);
    if (pending !== undefined) return pending.promise;

    const token = {};
    const promise = Promise.resolve()
      .then(subscribe)
      .then(() => {
        if (this.#pending.get(repositoryId)?.token === token) {
          this.#watched.add(repositoryId);
        }
      })
      .finally(() => {
        if (this.#pending.get(repositoryId)?.token === token) {
          this.#pending.delete(repositoryId);
        }
      });
    this.#pending.set(repositoryId, { token, promise });
    return promise;
  }

  forget(repositoryId: string): void {
    this.#pending.delete(repositoryId);
    this.#watched.delete(repositoryId);
  }

  trackedRepositoryIds(): readonly string[] {
    return [...new Set([...this.#watched, ...this.#pending.keys()])];
  }

  isWatched(repositoryId: string): boolean {
    return this.#watched.has(repositoryId);
  }
}
