import type { GitFailureCode } from "../../../src/shared/contracts/git-utility";

export class GitUtilityError extends Error {
  readonly code: GitFailureCode;
  readonly exitCode: number | null;

  constructor(code: GitFailureCode, message: string, exitCode: number | null = null) {
    super(message);
    this.name = "GitUtilityError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

export function asGitUtilityError(error: unknown): GitUtilityError {
  if (error instanceof GitUtilityError) return error;
  if (error instanceof Error) return new GitUtilityError("spawnFailed", error.message);
  return new GitUtilityError("spawnFailed", "Unknown Git process failure");
}
