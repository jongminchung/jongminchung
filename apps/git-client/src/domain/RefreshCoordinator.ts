import type { RepositoryInvalidation } from "../generated";

type Refresh = (
    repositoryId: string,
    invalidations: readonly RepositoryInvalidation[],
) => Promise<void>;

type HandleError = (repositoryId: string, error: unknown) => void;

interface CoordinationState {
    readonly pending: Set<RepositoryInvalidation>;
    scheduled: boolean;
    running: Promise<void> | null;
}

const INVALIDATION_ORDER: readonly RepositoryInvalidation[] = [
    "status",
    "history",
    "stash",
    "operation",
    "management",
];

export class RefreshCoordinator {
    readonly #states = new Map<string, CoordinationState>();
    readonly #deferred = new Map<string, Set<RepositoryInvalidation>>();

    private constructor(
        private readonly refresh: Refresh,
        private readonly handleError: HandleError,
    ) {}

    static of(
        refresh: Refresh,
        handleError: HandleError = (): void => undefined,
    ): RefreshCoordinator {
        return new RefreshCoordinator(refresh, handleError);
    }

    invalidate(
        repositoryId: string,
        invalidations: readonly RepositoryInvalidation[],
    ): void {
        if (invalidations.length === 0) return;
        const state = this.#states.get(repositoryId) ?? {
            pending: new Set<RepositoryInvalidation>(),
            scheduled: false,
            running: null,
        };
        this.#states.set(repositoryId, state);
        for (const invalidation of invalidations)
            state.pending.add(invalidation);
        this.schedule(repositoryId, state);
    }

    defer(
        repositoryId: string,
        invalidations: readonly RepositoryInvalidation[],
    ): void {
        if (invalidations.length === 0) return;
        const pending =
            this.#deferred.get(repositoryId) ??
            new Set<RepositoryInvalidation>();
        for (const invalidation of invalidations) pending.add(invalidation);
        this.#deferred.set(repositoryId, pending);
    }

    async resume(repositoryId: string): Promise<boolean> {
        const pending = this.#deferred.get(repositoryId);
        if (!pending) return false;
        this.#deferred.delete(repositoryId);
        this.invalidate(repositoryId, [...pending]);
        await this.flush(repositoryId);
        return true;
    }

    async flush(repositoryId: string): Promise<void> {
        while (true) {
            const state = this.#states.get(repositoryId);
            if (!state) return;
            if (state.scheduled) {
                await Promise.resolve();
                continue;
            }
            if (state.running) {
                await state.running;
                continue;
            }
            if (state.pending.size > 0) {
                this.schedule(repositoryId, state);
                continue;
            }
            this.#states.delete(repositoryId);
            return;
        }
    }

    forget(repositoryId: string): void {
        this.#states.delete(repositoryId);
        this.#deferred.delete(repositoryId);
    }

    private schedule(repositoryId: string, state: CoordinationState): void {
        if (state.scheduled || state.running || state.pending.size === 0)
            return;
        state.scheduled = true;
        queueMicrotask(() => this.start(repositoryId, state));
    }

    private start(repositoryId: string, state: CoordinationState): void {
        state.scheduled = false;
        if (state.running || state.pending.size === 0) return;
        const invalidations = INVALIDATION_ORDER.filter((scope) =>
            state.pending.delete(scope),
        );
        const run = async (): Promise<void> => {
            try {
                await this.refresh(repositoryId, invalidations);
            } catch (error) {
                this.handleError(repositoryId, error);
            } finally {
                state.running = null;
                if (state.pending.size > 0) this.schedule(repositoryId, state);
                else this.#states.delete(repositoryId);
            }
        };
        state.running = run();
    }
}
