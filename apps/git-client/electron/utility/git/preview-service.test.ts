import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { GitProcessRunner } from "./git-process";
import { GitPreviewService } from "./preview-service";
import { RepositoryRegistry } from "./repository-registry";

const fixtures: string[] = [];

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

function git(cwd: string, ...args: readonly string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

async function createRepository(): Promise<{
  readonly root: string;
  readonly repository: string;
  readonly remote: string;
  readonly registry: RepositoryRegistry;
  readonly service: GitPreviewService;
  readonly repositoryId: Awaited<ReturnType<RepositoryRegistry["open"]>>["id"];
}> {
  const root = await mkdtemp(join(tmpdir(), "git-client-preview-"));
  fixtures.push(root);
  const repository = join(root, "repository");
  const remote = join(root, "remote.git");
  await Promise.all([mkdir(repository), mkdir(remote)]);
  git(remote, "init", "--bare");
  git(repository, "init", "--initial-branch=main");
  git(repository, "config", "user.name", "Git Client QA");
  git(repository, "config", "user.email", "qa@example.invalid");
  git(repository, "remote", "add", "origin", remote);
  await writeFile(join(repository, "one.txt"), "one\n", "utf8");
  git(repository, "add", "one.txt");
  git(repository, "commit", "-m", "one");
  const runner = new GitProcessRunner();
  const registry = new RepositoryRegistry(runner);
  const record = await registry.open(repository);
  return {
    root,
    repository,
    remote,
    registry,
    service: GitPreviewService.of(registry, runner, () => 123_456),
    repositoryId: record.id,
  };
}

describe("GitPreviewService push preview", () => {
  test("reports a new branch then an exact fast-forward lease", async () => {
    const fixture = await createRepository();
    const first = await fixture.service.pushPreview(fixture.repositoryId, null, null, "HEAD");
    expect(first).toMatchObject({
      sourceBranch: "main",
      remote: "origin",
      remoteRef: "refs/heads/main",
      upstreamConfigured: false,
      setUpstreamDefault: true,
      remoteOid: null,
      expectedLeaseOid: null,
      fastForward: true,
      newBranch: true,
      checkedAtMs: 123_456,
      protectedBranch: true,
    });
    expect(first.commits.map((commit) => commit.subject)).toEqual(["one"]);

    git(fixture.repository, "push", "--set-upstream", "origin", "main");
    await writeFile(join(fixture.repository, "two.txt"), "two\n", "utf8");
    git(fixture.repository, "add", "two.txt");
    git(fixture.repository, "commit", "-m", "two");
    const second = await fixture.service.pushPreview(fixture.repositoryId, null, null, "HEAD");
    expect(second).toMatchObject({
      upstreamConfigured: true,
      setUpstreamDefault: false,
      ahead: 1,
      behind: 0,
      fastForward: true,
      newBranch: false,
    });
    expect(second.remoteOid).toBe(second.expectedLeaseOid);
    expect(second.commits.map((commit) => commit.subject)).toEqual(["two"]);
    expect(second.warnings).toContain(
      "This destination is commonly protected and requires branch-name confirmation for force push.",
    );
  });

  test("reports divergent local and remote commits after fetch", async () => {
    const fixture = await createRepository();
    git(fixture.repository, "push", "--set-upstream", "origin", "main");
    const peer = join(fixture.root, "peer");
    git(fixture.root, "clone", "--branch", "main", fixture.remote, peer);
    git(peer, "config", "user.name", "Peer");
    git(peer, "config", "user.email", "peer@example.invalid");
    await writeFile(join(peer, "remote.txt"), "remote\n", "utf8");
    git(peer, "add", "remote.txt");
    git(peer, "commit", "-m", "remote");
    git(peer, "push", "origin", "main");
    await writeFile(join(fixture.repository, "local.txt"), "local\n", "utf8");
    git(fixture.repository, "add", "local.txt");
    git(fixture.repository, "commit", "-m", "local");
    git(fixture.repository, "fetch", "origin");

    const preview = await fixture.service.pushPreview(
      fixture.repositoryId,
      "origin",
      "refs/heads/main",
      "HEAD",
    );
    expect(preview).toMatchObject({
      ahead: 1,
      behind: 1,
      fastForward: false,
    });
    expect(preview.commits.map((commit) => commit.subject)).toEqual(["local"]);
    expect(preview.remoteOnlyCommits.map((commit) => commit.subject)).toEqual(["remote"]);
    expect(preview.warnings).toContain(
      "The destination is not a fast-forward. Normal push is disabled.",
    );
  });

  test("rejects unsafe remote targets and detached destinations", async () => {
    const fixture = await createRepository();
    await expect(
      fixture.service.pushPreview(fixture.repositoryId, "--upload-pack=oops", null, "HEAD"),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(
      fixture.service.pushPreview(fixture.repositoryId, "origin", "main", "HEAD"),
    ).rejects.toMatchObject({ code: "invalidInput" });
    git(fixture.repository, "checkout", "--detach");
    await expect(
      fixture.service.pushPreview(fixture.repositoryId, null, null, "HEAD"),
    ).rejects.toMatchObject({ code: "invalidInput" });
  });
});

describe("GitPreviewService history rewrite preview", () => {
  test("captures published commits and dependent refs without changing the repository", async () => {
    const fixture = await createRepository();
    git(fixture.repository, "push", "--set-upstream", "origin", "main");
    await writeFile(join(fixture.repository, "two.txt"), "two\n", "utf8");
    git(fixture.repository, "add", "two.txt");
    git(fixture.repository, "commit", "-m", "two");
    git(fixture.repository, "push");
    git(fixture.repository, "branch", "dependent", "HEAD");
    await writeFile(join(fixture.repository, "three.txt"), "three\n", "utf8");
    git(fixture.repository, "add", "three.txt");
    git(fixture.repository, "commit", "-m", "three");
    const before = git(fixture.repository, "status", "--porcelain=v2", "--branch");

    const preview = await fixture.service.historyRewritePreview(fixture.repositoryId, "HEAD~1");
    expect(preview).toMatchObject({
      branch: "main",
      root: false,
      descendantCount: 2,
      publishedCommitCount: 1,
      hasMerges: false,
      protectedBranch: true,
    });
    expect(preview.entries.map((entry) => [entry.subject, entry.published])).toEqual([
      ["two", true],
      ["three", false],
    ]);
    expect(preview.dependentRefs.map((entry) => entry.name)).toEqual(["refs/heads/dependent"]);
    expect(preview.warnings).toEqual(
      expect.arrayContaining([
        "1 published commit(s) will receive new object IDs; pushing later requires explicit review.",
        "1 dependent local ref(s) may need updating.",
      ]),
    );
    expect(git(fixture.repository, "status", "--porcelain=v2", "--branch")).toBe(before);
  });

  test("rejects detached and in-progress repositories", async () => {
    const fixture = await createRepository();
    git(fixture.repository, "checkout", "--detach");
    await expect(
      fixture.service.historyRewritePreview(fixture.repositoryId, "HEAD"),
    ).rejects.toMatchObject({ code: "invalidInput" });
    git(fixture.repository, "switch", "main");
    await mkdir(join(fixture.repository, ".git", "rebase-merge"));
    await expect(
      fixture.service.historyRewritePreview(fixture.repositoryId, "HEAD"),
    ).rejects.toMatchObject({ code: "invalidInput" });
  });
});
