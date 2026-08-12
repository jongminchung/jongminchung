export interface CapturedGitState {
    readonly head: string;
    readonly refs: string;
    readonly status: string;
    readonly index: string;
    readonly reflog: string;
    readonly remotes: string;
    readonly config: string;
    readonly worktrees: string;
    readonly stashes: string;
    readonly submodules: string;
}

export function captureGitState(repository: string): CapturedGitState;
