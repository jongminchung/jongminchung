import { spawnSync } from "node:child_process";
import {
  chmod,
  mkdtemp,
  mkdir,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GitProcessRunner } from "./git-process";
import {
  parseGitConfig,
  parseSubmoduleStatus,
  parseWorktrees,
  detectInProgressOperation,
  RepositoryInspectionService,
} from "./repository-inspection-service";
import { RepositoryRegistry } from "./repository-registry";

const temporaryDirectories: string[] = [];

function git(cwd: string, ...args: readonly string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      GIT_PAGER: "cat",
      GIT_OPTIONAL_LOCKS: "0",
      LC_ALL: "C",
    },
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0)
    throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout;
}

async function createRepository(): Promise<{
  readonly root: string;
  readonly registry: RepositoryRegistry;
  readonly service: RepositoryInspectionService;
}> {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "git-client-inspection-"),
  );
  temporaryDirectories.push(temporaryDirectory);
  const root = join(temporaryDirectory, "repository");
  await mkdir(root);
  git(root, "init", "--initial-branch=main");
  git(root, "config", "user.name", "Git Client Test");
  git(root, "config", "user.email", "git-client@example.invalid");
  await writeFile(join(root, "tracked.txt"), "initial\n", "utf8");
  git(root, "add", "--", "tracked.txt");
  git(root, "commit", "-m", "initial");
  const runner = new GitProcessRunner();
  const registry = new RepositoryRegistry(runner);
  return {
    root,
    registry,
    service: new RepositoryInspectionService(registry, runner),
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("교체검사서비스", () => {
  it("[성공] 수정된 구성, 원격, 밀봉된 분기, 서명 및 작업 트리를 유지함", async () => {
    const { root, registry, service } = await createRepository();
    git(root, "config", "credential.helper", "secret-helper");
    git(
      root,
      "remote",
      "add",
      "origin",
      "https://user:password@example.invalid/repo.git",
    );
    const linked = join(root, "..", "linked");
    git(root, "worktree", "add", "-b", "linked", linked);
    const record = await registry.open(root);

    await expect(service.listGitConfig(record.id)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "credential.helper",
          value: "[redacted]",
        }),
      ]),
    );
    await expect(service.listRemotes(record.id)).resolves.toEqual([
      {
        name: "origin",
        fetchUrl: "https://[redacted]@example.invalid/repo.git",
        pushUrl: "https://[redacted]@example.invalid/repo.git",
      },
    ]);
    await expect(
      service.listMergedBranches(record.id, "HEAD"),
    ).resolves.toContain("main");
    await expect(
      service.loadCommitSignature(record.id, "HEAD"),
    ).resolves.toMatchObject({
      status: "N",
      fingerprint: null,
    });
    await expect(service.listSubmodules(record.id)).resolves.toEqual([]);
    const worktrees = await service.listWorktrees(record.id);
    const canonicalRoot = await realpath(root);
    const canonicalLinked = await realpath(linked);
    expect(worktrees).toHaveLength(2);
    expect(worktrees).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: canonicalRoot,
          branch: "main",
          isMain: true,
        }),
        expect.objectContaining({
          path: canonicalLinked,
          branch: "linked",
          isMain: false,
        }),
      ]),
    );
  });

  it("[성공] 완전한 Clean, Detached, Remote, Shallow 및 Operation 스냅샷 필드를 검사함", async () => {
    const { root, registry, service } = await createRepository();
    git(
      root,
      "remote",
      "add",
      "origin",
      "https://u:p@example.invalid/repo.git",
    );
    const record = await registry.open(root);
    await expect(service.inspectSnapshot(record.id)).resolves.toMatchObject({
      currentBranch: "main",
      headOid: expect.stringMatching(/^[0-9a-f]{40}$/u),
      remoteUrl: "https://[redacted]@example.invalid/repo.git",
      isShallow: false,
      isDetached: false,
      hasCommits: true,
      operation: null,
    });

    git(root, "checkout", "--detach", "HEAD");
    await writeFile(join(root, ".git", "MERGE_HEAD"), "1".repeat(40), "utf8");
    await expect(service.inspectSnapshot(record.id)).resolves.toMatchObject({
      currentBranch: null,
      isDetached: true,
      operation: "merge",
    });
  });

  it("[실패] Git을 생성하기 전에 안전하지 않았음을 의미함", async () => {
    const { root, registry, service } = await createRepository();
    const record = await registry.open(root);
    await expect(
      service.listMergedBranches(record.id, "--all"),
    ).rejects.toMatchObject({
      code: "invalidInput",
    });
    await expect(
      service.loadCommitSignature(record.id, "HEAD\n--all"),
    ).rejects.toMatchObject({
      code: "invalidInput",
    });
  });

  it("[성공] 브랜치를 칭찬하고 단계적 커밋 위험과 후크를 검사함", async () => {
    const { root, registry, service } = await createRepository();
    git(root, "checkout", "-b", "feature");
    await writeFile(join(root, "feature.txt"), "feature\n", "utf8");
    git(root, "add", "--", "feature.txt");
    git(root, "commit", "-m", "feature");
    git(root, "checkout", "main");
    git(root, "config", "core.autocrlf", "false");
    await writeFile(
      join(root, "line-ending.txt"),
      "first\r\nsecond\r\n",
      "utf8",
    );
    await writeFile(join(root, "risky."), "risk\n", "utf8");
    git(root, "add", "--", "line-ending.txt", "risky.");
    const hook = join(root, ".git", "hooks", "pre-commit");
    await writeFile(hook, "#!/bin/sh\nexit 0\n", "utf8");
    await chmod(hook, 0o755);
    const record = await registry.open(root);

    await expect(
      service.compareBranches(record.id, "feature", "main"),
    ).resolves.toMatchObject({
      ahead: 1,
      behind: 0,
      leftOnly: [expect.stringMatching(/^[0-9a-f]{40}$/u)],
      rightOnly: [],
    });
    await expect(service.preCommitCheck(record.id)).resolves.toMatchObject({
      branch: "main",
      detachedHead: false,
      protectedBranch: true,
      crlfPaths: ["line-ending.txt"],
      riskyPaths: ["risky."],
      hooks: ["pre-commit"],
    });
  });
});

describe("전자검사 파서", () => {
  it("[성공] Git 상태 모델과 동급 최고의 순위를 사용함", async () => {
    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), "git-client-operation-state-"),
    );
    temporaryDirectories.push(temporaryDirectory);
    const gitDirectory = join(temporaryDirectory, "git");
    const commonDirectory = join(temporaryDirectory, "common");
    await mkdir(gitDirectory);
    await mkdir(commonDirectory);
    await writeFile(join(gitDirectory, "MERGE_HEAD"), "oid", "utf8");
    await mkdir(join(gitDirectory, "rebase-merge"));
    await writeFile(join(commonDirectory, "BISECT_LOG"), "log", "utf8");
    await expect(
      detectInProgressOperation(gitDirectory, commonDirectory),
    ).resolves.toBe("rebase");
  });

  it("[성공] 구성 트리플을 삽입 분석하고 비밀 및 내장된 자격 증명을 수정함", () => {
    expect(
      parseGitConfig(
        "local\0file:.git/config\0credential.helper\nsecret\0" +
          "local\0file:.git/config\0remote.origin.url\nhttps://u:p@example.invalid/r.git\0",
      ),
    ).toEqual([
      {
        key: "credential.helper",
        value: "[redacted]",
        origin: "file:.git/config",
        scope: "local",
      },
      {
        key: "remote.origin.url",
        value: "https://[redacted]@example.invalid/r.git",
        origin: "file:.git/config",
        scope: "local",
      },
    ]);
  });

  it("[성공] 모든 하위 모듈 상태 표시기를 분석함", () => {
    expect(
      parseSubmoduleStatus(
        "-1111111111111111111111111111111111111111 one (heads/main)\n" +
          "+2222222222222222222222222222222222222222 two (v1)\n" +
          "U3333333333333333333333333333333333333333 three\n" +
          " 4444444444444444444444444444444444444444 four\n",
      ),
    ).toEqual([
      expect.objectContaining({
        path: "one",
        status: "uninitialized",
        initialized: false,
      }),
      expect.objectContaining({
        path: "two",
        status: "modified",
        initialized: true,
      }),
      expect.objectContaining({
        path: "three",
        status: "conflicted",
        initialized: true,
      }),
      expect.objectContaining({
        path: "four",
        status: "clean",
        initialized: true,
      }),
    ]);
  });

  it("[성공] 기본, 분리, 운동 및 정리 가능한 작업 트리 삽입을 분석함", async () => {
    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), "git-client-worktree-parser-"),
    );
    temporaryDirectories.push(temporaryDirectory);
    const main = join(temporaryDirectory, "main");
    const linked = join(temporaryDirectory, "linked path");
    await mkdir(main);
    await mkdir(linked);
    const output =
      `worktree ${main}\0HEAD abc\0branch refs/heads/main\0\0` +
      `worktree ${linked}\0HEAD def\0detached\0locked reason\0prunable missing\0\0`;
    await expect(parseWorktrees(output, main)).resolves.toEqual([
      expect.objectContaining({
        path: main,
        branch: "main",
        isMain: true,
      }),
      expect.objectContaining({
        path: linked,
        detached: true,
        locked: true,
        prunable: true,
        isMain: false,
      }),
    ]);
  });
});
