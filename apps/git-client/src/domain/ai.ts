import type { Commit, FileChange } from "./types";

export interface CommitAiContext {
  readonly commits: readonly Commit[];
  readonly files: readonly FileChange[];
  readonly patch: string;
}

export interface CommitAiProvider {
  readonly id: string;
  readonly label: string;
  selfReview(context: CommitAiContext, signal: AbortSignal): Promise<string>;
  explainCommits(context: CommitAiContext, signal: AbortSignal): Promise<string>;
}

export const commitAiProvider: CommitAiProvider | undefined = undefined;
