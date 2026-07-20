import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

function git(repository, args, allowFailure = false) {
  const result = spawnSync("git", args, {
    cwd: repository,
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C" },
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args.join(" ")} failed: ${(result.stderr ?? "").trim()}`);
  }
  return result.status === 0 ? (result.stdout ?? "") : "";
}

export function captureGitState(repository) {
  const root = resolve(repository);
  git(root, ["rev-parse", "--git-dir"]);
  return Object.freeze({
    head: git(root, ["rev-parse", "--verify", "HEAD"], true).trim(),
    refs: git(root, [
      "for-each-ref",
      "--sort=refname",
      "--format=%(refname)%00%(objectname)%00%(upstream)%00%(symref)",
    ]),
    status: git(root, ["status", "--porcelain=v2", "--branch", "--untracked-files=all"]),
    index: git(root, ["ls-files", "--stage", "--debug"]),
    reflog: git(root, ["reflog", "--format=%H%x00%gs"], true),
    remotes: git(root, ["remote", "-v"]),
    config: git(root, ["config", "--local", "--list", "--null"]),
    worktrees: git(root, ["worktree", "list", "--porcelain"]),
    stashes: git(root, ["stash", "list", "--format=%H%x00%gs"], true),
    submodules: git(root, ["submodule", "status", "--recursive"], true),
  });
}
