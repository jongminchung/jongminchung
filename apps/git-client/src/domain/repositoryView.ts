import type { RepositorySnapshot } from "../generated";
import type { Commit, Ref, RepositoryView, StatusModel } from "./types";

export interface RepositoryViewUpdate {
    readonly snapshot?: RepositorySnapshot;
    readonly refs?: readonly Ref[];
    readonly commits?: readonly Commit[];
    readonly status?: StatusModel;
}

export function updateRepositoryView(
    repository: RepositoryView,
    update: RepositoryViewUpdate,
): RepositoryView {
    const snapshot = update.snapshot ?? repository.snapshot;
    const refs = update.refs ?? repository.refs;
    const commits = update.commits ?? repository.commits;
    const status = update.status ?? repository.status;
    if (
        snapshot === repository.snapshot &&
        refs === repository.refs &&
        commits === repository.commits &&
        status === repository.status
    ) {
        return repository;
    }
    return { snapshot, refs, commits, status };
}
