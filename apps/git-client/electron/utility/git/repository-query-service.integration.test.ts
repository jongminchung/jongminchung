import { spawnSync } from "node:child_process";
import {
  access,
  mkdtemp,
  mkdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { GitDomainQueryRequest } from "../../../src/shared/contracts/git-request";
import {
  GIT_OUTPUT_LIMIT_BYTES,
  GIT_QUERY_TIMEOUT_MS,
} from "../../../src/shared/contracts/git-utility";
import {
  GitProcessRunner,
  type GitProcessSpec,
  type GitProcessRunnerLike,
} from "./git-process";
import { RepositoryQueryService } from "./repository-query-service";
import { RepositoryRegistry } from "./repository-registry";

const temporaryDirectories: string[] = [];
const secretToken = "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890";
const shellMetacharacterPath = "tracked;touch injected";

function git(cwd: string, ...args: readonly string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
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

async function fixture(): Promise<{
  readonly root: string;
  readonly repositoryId: string;
  readonly registry: RepositoryRegistry;
  readonly service: RepositoryQueryService;
}> {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "git-client-repository-query-"),
  );
  temporaryDirectories.push(temporaryDirectory);
  const root = join(temporaryDirectory, "repository");
  await mkdir(root);
  git(root, "init", "--initial-branch=main");
  git(root, "config", "user.name", "Git Client Test");
  git(root, "config", "user.email", "git-client@example.invalid");
  git(root, "config", "commit.gpgsign", "false");
  git(root, "config", "rerere.enabled", "false");
  await writeFile(join(root, ".gitignore"), "ignored.txt\n", "utf8");
  await writeFile(join(root, "tracked.txt"), "initial\n", "utf8");
  await writeFile(join(root, shellMetacharacterPath), "shell-safe\n", "utf8");
  git(root, "add", "--", ".gitignore", "tracked.txt", shellMetacharacterPath);
  git(root, "commit", "-m", "initial");
  await writeFile(join(root, "tracked.txt"), "second\n", "utf8");
  git(root, "commit", "-am", "second");
  await writeFile(join(root, "latest.txt"), "latest\n", "utf8");
  git(root, "add", "--", "latest.txt");
  git(root, "commit", "-m", "latest");

  const remote = join(temporaryDirectory, "remote.git");
  await mkdir(remote);
  git(remote, "init", "--bare", "--initial-branch=main");
  git(root, "remote", "add", "origin", remote);
  git(root, "push", "--set-upstream", "origin", "main");
  git(
    root,
    "config",
    "http.https://example.invalid.extraheader",
    `Authorization: Bearer ${secretToken}`,
  );

  await writeFile(join(root, "tracked.txt"), "stashed\n", "utf8");
  await writeFile(join(root, "untracked.txt"), "untracked\n", "utf8");
  git(root, "stash", "push", "--include-untracked", "--message", "saved state");
  await writeFile(join(root, "tracked.txt"), "working\n", "utf8");
  await writeFile(join(root, "ignored.txt"), "ignored\n", "utf8");
  await writeFile(
    join(root, "token=private-token.txt"),
    "repository data\n",
    "utf8",
  );

  const runner = new GitProcessRunner();
  const registry = new RepositoryRegistry(runner);
  const repositoryAlias = join(temporaryDirectory, "repository-link");
  await symlink(root, repositoryAlias, "dir");
  const repository = await registry.open(repositoryAlias);
  return {
    root,
    repositoryId: repository.id,
    registry,
    service: RepositoryQueryService.of(registry, runner),
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("쿼리서비스", () => {
  it("[성공] 등록된 참가자에서 검증된 상태 요청을 실행함", async () => {
    const { repositoryId, service } = await fixture();
    const request: GitDomainQueryRequest = { kind: "status", repositoryId };

    await expect(service.execute(request)).resolves.toMatchObject({
      kind: "completed",
      queryKind: "status",
      exitCode: 0,
      stdout: expect.stringContaining("# branch.head main"),
      stderr: "",
    });
  });

  it("[성공] 17가지 읽기에 Git이 요청하는 종류를 모두 실행하고 있음을 확인함", async () => {
    const { repositoryId, root, service } = await fixture();
    const requests = [
      { kind: "status", repositoryId },
      { kind: "refs", repositoryId },
      {
        kind: "log",
        repositoryId,
        skip: 0,
        limit: 50,
        order: "topology",
        filters: {
          query: null,
          branch: null,
          author: null,
          since: null,
          until: null,
          paths: [],
          noMerges: false,
          regex: false,
          matchCase: false,
        },
      },
      { kind: "commitDetails", repositoryId, revision: "HEAD" },
      {
        kind: "diff",
        repositoryId,
        from: null,
        to: null,
        paths: ["tracked.txt"],
        staged: false,
        options: { whitespace: "show", contextLines: 3 },
      },
      { kind: "tree", repositoryId, revision: "HEAD", path: null },
      {
        kind: "fileHistory",
        repositoryId,
        path: shellMetacharacterPath,
        skip: 0,
        limit: 50,
      },
      {
        kind: "blame",
        repositoryId,
        revision: "HEAD",
        path: "tracked.txt",
      },
      { kind: "stashList", repositoryId },
      {
        kind: "stashShow",
        repositoryId,
        stash: "stash@{0}",
        mode: "files",
      },
      { kind: "configList", repositoryId },
      { kind: "submoduleStatus", repositoryId },
      { kind: "signature", repositoryId, revision: "HEAD" },
      { kind: "checkIgnored", repositoryId, paths: ["ignored.txt"] },
      { kind: "mergedBranches", repositoryId, target: "HEAD" },
      {
        kind: "pushPreview",
        repositoryId,
        remote: "origin",
        remoteRef: "refs/heads/main",
        localRevision: "HEAD",
      },
      {
        kind: "historyRewritePreview",
        repositoryId,
        fromRevision: "HEAD~1",
      },
    ] satisfies readonly GitDomainQueryRequest[];
    const output = new Map<GitDomainQueryRequest["kind"], string>();

    expect(requests).toHaveLength(17);
    expect(new Set(requests.map(({ kind }) => kind)).size).toBe(17);
    for (const request of requests) {
      const outcome = await service.execute(request);
      expect(outcome.kind, request.kind).toBe("completed");
      if (outcome.kind !== "completed") continue;
      expect(outcome.queryKind).toBe(request.kind);
      expect(outcome.stderr).toBe("");
      output.set(request.kind, outcome.stdout);
    }

    expect(output.get("status")).toContain("# branch.head main");
    expect(output.get("status")).toContain("token=private-token.txt");
    expect(output.get("refs")).toContain("refs/heads/main\0");
    expect(output.get("log")).toContain("latest");
    expect(output.get("commitDetails")).toContain("latest");
    expect(output.get("diff")).toContain("+working");
    expect(output.get("tree")).toContain("tracked.txt\0");
    expect(output.get("fileHistory")).toContain("initial");
    expect(output.get("blame")).toContain("author Git Client Test");
    expect(output.get("stashList")).toContain("saved state");
    expect(output.get("stashShow")).toContain("tracked.txt\0");
    expect(output.get("configList")).toContain("[redacted]");
    expect(output.get("configList")).not.toContain(secretToken);
    expect(output.get("submoduleStatus")).toBe("");
    expect(output.get("signature")?.startsWith("N\0")).toBe(true);
    expect(output.get("checkIgnored")).toBe("ignored.txt\0");
    expect(output.get("mergedBranches")).toContain("refs/heads/main\0");
    expect(output.get("pushPreview")).toContain("refs/heads/main");
    expect(output.get("historyRewritePreview")).toContain("latest");
    await expect(pathExists(join(root, "injected"))).resolves.toBe(false);
  });

  it("[실패] 자리를 입력하지 않고, 알 수 없는 외부 및 Git 오류에 대한 실패를 거부함", async () => {
    const { repositoryId, service } = await fixture();
    const invalid = await service.execute({
      kind: "log",
      repositoryId,
      skip: -1,
      limit: 5_001,
      order: "topology",
      filters: {},
    });
    expect(invalid).toMatchObject({
      kind: "failed",
      queryKind: null,
      code: "invalidInput",
      stdout: "",
      stderr: "",
    });
    expect(
      invalid.kind === "failed" ? invalid.message.length : 0,
    ).toBeLessThanOrEqual(4_096);

    await expect(
      service.execute({
        kind: "status",
        repositoryId: "00000000-0000-4000-8000-000000000099",
      }),
    ).resolves.toMatchObject({
      kind: "failed",
      queryKind: "status",
      code: "repositoryNotOpen",
    });
    await expect(
      service.execute({
        kind: "commitDetails",
        repositoryId,
        revision: "f".repeat(40),
      }),
    ).resolves.toMatchObject({
      kind: "failed",
      queryKind: "commitDetails",
      code: "commandFailed",
      exitCode: expect.any(Number),
    });
  });

  it("[성공] 선호의 표준 cwd에서 실행하고 활성 취소를 매핑함", async () => {
    const { registry, repositoryId, root } = await fixture();
    let observedSpec: GitProcessSpec | null = null;
    const runner: GitProcessRunnerLike = {
      run: (spec, signal) =>
        new Promise((resolve) => {
          observedSpec = spec;
          const cancelled = (): void => {
            resolve({
              kind: "cancelled",
              reason:
                signal?.reason === "repositoryClosed"
                  ? "repositoryClosed"
                  : "requested",
              durationMs: 1,
              output: [],
            });
          };
          if (signal?.aborted === true) cancelled();
          else
            signal?.addEventListener("abort", cancelled, {
              once: true,
            });
        }),
    };
    const service = RepositoryQueryService.of(registry, runner);
    const cancellation = new AbortController();
    const pending = service.execute(
      { kind: "status", repositoryId },
      cancellation.signal,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    cancellation.abort("requested");

    await expect(pending).resolves.toMatchObject({
      kind: "cancelled",
      queryKind: "status",
      reason: "requested",
    });
    expect(observedSpec).toMatchObject({
      cwd: await realpath(root),
      args: [
        "status",
        "--porcelain=v2",
        "-z",
        "--branch",
        "--show-stash",
        "--untracked-files=all",
      ],
      redactStdout: false,
      timeoutMs: GIT_QUERY_TIMEOUT_MS,
      outputLimitBytes: GIT_OUTPUT_LIMIT_BYTES,
    });
  });

  it("[성공] 청크를 인증하는 시험 처리 자격 증명을 수정하기 전에 스트림을 감사함", async () => {
    const { registry, repositoryId } = await fixture();
    const runner: GitProcessRunnerLike = {
      run: () =>
        Promise.resolve({
          kind: "completed",
          exitCode: 0,
          durationMs: 2,
          output: [
            { stream: "stdout", data: "https://alice:" },
            { stream: "stderr", data: "Authorization: Bearer " },
            {
              stream: "stdout",
              data: "secret@example.invalid/repo token=private-token",
            },
            { stream: "stderr", data: secretToken },
          ],
        }),
    };
    const service = RepositoryQueryService.of(registry, runner);
    const outcome = await service.execute({
      kind: "configList",
      repositoryId,
    });

    expect(outcome).toMatchObject({
      kind: "completed",
      stdout: expect.stringContaining(
        "https://[redacted]@example.invalid/repo",
      ),
      stderr: expect.stringContaining("Authorization: Bearer [redacted]"),
    });
    expect(JSON.stringify(outcome)).not.toContain("alice");
    expect(JSON.stringify(outcome)).not.toContain("secret");
    expect(JSON.stringify(outcome)).not.toContain("private-token");
    expect(JSON.stringify(outcome)).not.toContain(secretToken);
    expect(outcome.output.map(({ stream }) => stream)).toEqual([
      "stdout",
      "stderr",
      "stdout",
      "stderr",
    ]);
  });

  it("[실패] 다음 항목을 사용하지 않고 NUL로 구분된 구성 비밀을 수정함", async () => {
    const { registry, repositoryId } = await fixture();
    const configOutput = [
      "file:.git/config",
      `http.https://example.invalid.extraheader\nAuthorization: Bearer ${secretToken}`,
      "file:.git/config",
      "user.name\nAda Lovelace",
      "",
    ].join("\0");
    const runner: GitProcessRunnerLike = {
      run: () =>
        Promise.resolve({
          kind: "completed",
          exitCode: 0,
          durationMs: 1,
          output: [{ stream: "stdout", data: configOutput }],
        }),
    };
    const outcome = await RepositoryQueryService.of(registry, runner).execute({
      kind: "configList",
      repositoryId,
    });

    expect(outcome).toMatchObject({ kind: "completed" });
    expect(outcome.stdout).toContain("Authorization: Bearer [redacted]\0");
    expect(outcome.stdout).toContain(
      "\0file:.git/config\0user.name\nAda Lovelace\0",
    );
    expect(outcome.stdout).not.toContain(secretToken);
  });

  it("[성공] 오류 메시지를 수정하는 동안 전송 제한은 실패합니다. stdout을 유지함", async () => {
    const { registry, repositoryId } = await fixture();
    const runner: GitProcessRunnerLike = {
      run: () =>
        Promise.resolve({
          kind: "failed",
          code: "outputLimit",
          message: `token=${secretToken}`,
          exitCode: null,
          durationMs: 3,
          output: [
            {
              stream: "stdout",
              data: `https://user:${secretToken}@example.invalid`,
            },
          ],
        }),
    };
    const service = RepositoryQueryService.of(registry, runner);
    const outcome = await service.execute({ kind: "refs", repositoryId });

    expect(outcome).toMatchObject({
      kind: "failed",
      queryKind: "refs",
      code: "outputLimit",
      message: "token=[redacted]",
      stdout: `https://user:${secretToken}@example.invalid`,
    });
    expect(outcome.kind === "failed" ? outcome.message : "").not.toContain(
      secretToken,
    );
  });
});
