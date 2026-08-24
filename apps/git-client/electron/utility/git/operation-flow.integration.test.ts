import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAuditFixture } from "../../../scripts/independent-audit/create-fixture.ts";
import type { GitRequestId } from "../../../src/shared/contracts/git-utility";
import type { GitOperation } from "../../../src/shared/contracts/model";
import { GitUtility } from "./git-utility";

const temporaryDirectories: string[] = [];

function gitText(repositoryPath: string, ...args: readonly string[]): string {
  return execFileSync("git", args, {
    cwd: repositoryPath,
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C" },
  });
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("패키지화된 Git 작업", () => {
  it("[성공] 준비, 커밋, 분기, 분기 생성 및 원격으로 푸시", async () => {
    const fixtureRoot = await mkdtemp(
      join(tmpdir(), "git-client-operation-flow-"),
    );
    temporaryDirectories.push(fixtureRoot);
    const fixture = await createAuditFixture(fixtureRoot);
    const utility = new GitUtility();
    const repository = await utility.openRepository({
      path: fixture.gitClientPath,
    });
    vi.stubEnv("GIT_AUTHOR_DATE", "2025-01-15T12:03:00.000Z");
    vi.stubEnv("GIT_COMMITTER_DATE", "2025-01-15T12:03:00.000Z");

    const execute = async (operation: GitOperation): Promise<void> => {
      const terminal = await utility.executeQuery(
        {
          kind: "operation",
          operation,
          repositoryId: repository.id,
          requestId: randomUUID() as GitRequestId,
        },
        () => undefined,
      );
      expect(terminal.kind, operation.kind).toBe("completed");
    };

    await execute({ kind: "stage", paths: ["src/index.ts", "notes.txt"] });
    await execute({
      kind: "commit",
      message: "feat: complete operation flow",
      amend: false,
      signOff: false,
      gpgSign: false,
    });
    await execute({
      kind: "commit",
      message: "feat: complete operation flow (amended)",
      amend: true,
      signOff: false,
      gpgSign: false,
    });
    await execute({
      kind: "createBranch",
      name: "qa/operation-flow",
      startPoint: "HEAD",
      checkout: true,
    });
    await execute({
      kind: "push",
      destination: {
        remote: "origin",
        remoteRef: "refs/heads/qa/operation-flow",
        localRevision: "HEAD",
        setUpstream: true,
      },
      mode: { kind: "normal" },
    });

    expect(
      gitText(fixture.gitClientPath, "branch", "--show-current").trim(),
    ).toBe("qa/operation-flow");
    expect(gitText(fixture.gitClientPath, "status", "--porcelain")).toBe("");
    expect(
      gitText(fixture.gitClientPath, "log", "-2", "--format=%s")
        .trim()
        .split("\n"),
    ).toEqual([
      "feat: complete operation flow (amended)",
      "fixture: add shared source",
    ]);
    expect(
      gitText(
        fixture.gitClientPath,
        "for-each-ref",
        "--sort=refname",
        "--format=%(refname)",
        "refs/remotes/origin",
      )
        .trim()
        .split("\n"),
    ).toEqual([
      "refs/remotes/origin/HEAD",
      "refs/remotes/origin/feature/topic",
      "refs/remotes/origin/main",
      "refs/remotes/origin/qa/operation-flow",
    ]);
  }, 30_000);
});
