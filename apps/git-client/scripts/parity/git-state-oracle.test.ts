import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { captureGitState } from "./git-state-oracle.mjs";

function git(repository: string, ...args: readonly string[]): void {
  execFileSync("git", args, { cwd: repository, stdio: "ignore" });
}

describe("Git side-effect oracle", () => {
  it("detects repository changes and proves cancellation invariance", () => {
    const repository = mkdtempSync(join(tmpdir(), "git-client-oracle-"));
    git(repository, "init", "-b", "main");
    git(repository, "config", "user.name", "Parity Test");
    git(repository, "config", "user.email", "parity@example.invalid");
    writeFileSync(join(repository, "tracked.txt"), "before\n");
    git(repository, "add", "tracked.txt");
    git(repository, "commit", "-m", "initial");
    const before = captureGitState(repository);

    expect(captureGitState(repository)).toEqual(before);
    writeFileSync(join(repository, "tracked.txt"), "after\n");
    expect(captureGitState(repository)).not.toEqual(before);
  });
});
