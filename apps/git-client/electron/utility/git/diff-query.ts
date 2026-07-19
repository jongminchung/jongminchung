import type { DiffOptions } from "../../../src/generated";
import { GitUtilityError } from "./git-error";
import { validateRelativePath, validateRevision } from "./validation";

export interface GitDiffQuery {
  readonly from: string | null;
  readonly to: string | null;
  readonly paths: readonly string[];
  readonly staged: boolean;
  readonly options: DiffOptions;
}

function contextArgument(contextLines: number | null): string {
  if (contextLines === null) return "--unified=50000";
  if (contextLines === 3 || contextLines === 5 || contextLines === 10) {
    return `--unified=${contextLines}`;
  }
  throw new GitUtilityError("invalidInput", "Diff context lines must be 3, 5, 10, or null");
}

export function buildDiffArguments(query: GitDiffQuery): readonly string[] {
  const args = [
    "diff",
    "--no-color",
    "--no-ext-diff",
    "--find-renames",
    "--find-copies",
    "--patch",
  ];
  if (query.options.whitespace === "ignoreAll") args.push("--ignore-all-space");
  args.push(contextArgument(query.options.contextLines));
  if (query.staged) args.push("--cached");
  for (const revision of [query.from, query.to]) {
    if (revision === null) continue;
    validateRevision(revision);
    args.push(revision);
  }
  if (query.paths.length === 0) return args;
  args.push("--");
  for (const path of query.paths) {
    validateRelativePath(path);
    args.push(path);
  }
  return args;
}
