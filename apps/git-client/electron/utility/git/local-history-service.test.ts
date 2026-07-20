import { execFileSync } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rename, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GitProcessRunner } from "./git-process";
import { LocalHistoryService } from "./local-history-service";
import { RepositoryRegistry } from "./repository-registry";

function git(cwd: string, ...args: readonly string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" });
}

async function fixture(now: () => number = Date.now) {
  const root = await mkdtemp(join(tmpdir(), "git-client-local-history-"));
  const repositoryPath = join(root, "repository");
  const storageRoot = join(root, "profile");
  git(root, "init", repositoryPath);
  git(repositoryPath, "config", "user.name", "Local History Test");
  git(repositoryPath, "config", "user.email", "local-history@example.test");
  await writeFile(join(repositoryPath, "tracked.txt"), "one\n", "utf8");
  git(repositoryPath, "add", "tracked.txt");
  git(repositoryPath, "commit", "-m", "initial");
  const runner = new GitProcessRunner();
  const registry = new RepositoryRegistry(runner);
  const repository = await registry.open(repositoryPath);
  return {
    repository,
    repositoryPath,
    storageRoot,
    service: LocalHistoryService.of(registry, storageRoot, runner, now),
  };
}

describe("LocalHistoryService", () => {
  it("uses the initial project state only as a baseline", async () => {
    const { repository, service } = await fixture();

    await service.initialize(repository.id);

    await expect(
      service.list({ kind: "project", repositoryId: repository.id }, null),
    ).resolves.toEqual({ activities: [], nextCursor: null });
  });

  it("records reverse text deltas and restores the worktree without changing the index", async () => {
    const { repository, repositoryPath, service } = await fixture();
    await service.initialize(repository.id);
    await writeFile(join(repositoryPath, "tracked.txt"), "two\n", "utf8");
    git(repositoryPath, "add", "tracked.txt");
    await writeFile(join(repositoryPath, "tracked.txt"), "three\n", "utf8");

    const activity = await service.record(repository.id, "Editing tracked.txt");
    expect(activity).toMatchObject({ name: "Editing tracked.txt", changeCount: 1 });
    if (activity === null) throw new Error("Expected a Local History activity");
    await expect(service.diff(repository.id, activity.id, "tracked.txt")).resolves.toContain(
      "+three",
    );

    await service.revert(repository.id, activity.id, ["tracked.txt"], false);

    await expect(readFile(join(repositoryPath, "tracked.txt"), "utf8")).resolves.toBe("one\n");
    expect(git(repositoryPath, "show", ":tracked.txt")).toBe("two\n");
  });

  it("records binary structure changes without storing binary content", async () => {
    const { repository, repositoryPath, service } = await fixture();
    await service.initialize(repository.id);
    await writeFile(join(repositoryPath, "asset.png"), Buffer.from([0, 1, 2, 3]));

    const activity = await service.record(repository.id, "Created asset.png");
    if (activity === null) throw new Error("Expected a Local History activity");
    await expect(service.detail(repository.id, activity.id)).resolves.toMatchObject({
      changes: [{ kind: "create", path: "asset.png", contentAvailability: "unavailable" }],
    });
    await expect(service.diff(repository.id, activity.id, "asset.png")).resolves.toContain(
      "unavailable",
    );

    await service.revert(repository.id, activity.id, ["asset.png"], false);
    await expect(access(join(repositoryPath, "asset.png"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("keeps labels and purges activities older than five days", async () => {
    let currentTime = 1_000_000_000;
    const { repository, repositoryPath, service } = await fixture(() => currentTime);
    await service.initialize(repository.id);
    await service.putLabel(repository.id, "Before refactor");
    currentTime += 6 * 24 * 60 * 60 * 1_000;
    await writeFile(join(repositoryPath, "tracked.txt"), "after retention\n", "utf8");
    await service.record(repository.id, "Editing tracked.txt");

    const page = await service.list({ kind: "project", repositoryId: repository.id }, null);
    expect(page.activities).toHaveLength(1);
    expect(page.activities[0]?.name).toBe("Editing tracked.txt");
  });

  it("groups named multi-file operations and detects Unicode renames", async () => {
    const { repository, repositoryPath, service } = await fixture();
    await writeFile(join(repositoryPath, "first.txt"), "first\n", "utf8");
    await writeFile(join(repositoryPath, "second.txt"), "second\n", "utf8");
    await symlink("tracked.txt", join(repositoryPath, "tracked link"));
    await service.initialize(repository.id);
    await writeFile(join(repositoryPath, "first.txt"), "changed first\n", "utf8");
    await service.record(repository.id, "Replace in Files");
    await writeFile(join(repositoryPath, "second.txt"), "changed second\n", "utf8");
    await service.record(repository.id, "Replace in Files");

    const grouped = await service.list({ kind: "project", repositoryId: repository.id }, null);
    expect(grouped.activities).toHaveLength(1);
    expect(grouped.activities[0]).toMatchObject({ name: "Replace in Files", changeCount: 2 });

    await rename(join(repositoryPath, "first.txt"), join(repositoryPath, "한글 file.txt"));
    const renamed = await service.record(repository.id, "Renaming first.txt");
    if (renamed === null) throw new Error("Expected a rename activity");
    await expect(service.detail(repository.id, renamed.id)).resolves.toMatchObject({
      changes: [
        expect.objectContaining({
          kind: "rename",
          previousPath: "first.txt",
          path: "한글 file.txt",
        }),
      ],
    });
  });

  it("migrates consecutive v1 snapshots and keeps the original archive", async () => {
    const { repository, storageRoot, service } = await fixture(() => 10);
    const legacy = join(storageRoot, "local-history", repository.id);
    await mkdir(legacy, { recursive: true });
    const firstId = "723094e7-bf3b-4d3f-8f74-6cebe9571840";
    const secondId = "723094e7-bf3b-4d3f-8f74-6cebe9571841";
    const entry = (id: string, createdAtMs: number, label: string | null) => ({
      id,
      repositoryId: repository.id,
      createdAtMs,
      label,
      paths: ["tracked.txt"],
      snapshotSha256: "a".repeat(64),
      snapshotFile: id,
    });
    await writeFile(
      join(legacy, "manifest.json"),
      JSON.stringify({
        version: 1,
        entries: [entry(secondId, 2, "Before migration"), entry(firstId, 1, null)],
      }),
    );
    const snapshot = (content: string) => ({
      version: 1,
      trackedPaths: ["tracked.txt"],
      untrackedPaths: [],
      files: [
        {
          path: "tracked.txt",
          kind: "file",
          mode: 0o644,
          bytesBase64: Buffer.from(content).toString("base64"),
          sha256: "b".repeat(64),
        },
      ],
      index: { kind: "missing" },
      totalBytes: content.length,
      sha256: "c".repeat(64),
    });
    await writeFile(join(legacy, `${firstId}.json`), JSON.stringify(snapshot("one\n")));
    await writeFile(join(legacy, `${secondId}.json`), JSON.stringify(snapshot("two\n")));

    await service.initialize(repository.id);

    const page = await service.list({ kind: "project", repositoryId: repository.id }, null);
    expect(page.activities[0]).toMatchObject({
      id: secondId,
      label: "Before migration",
      changeCount: 1,
    });
    await expect(
      access(join(storageRoot, "local-history-v1-archive", repository.id, "manifest.json")),
    ).resolves.toBeUndefined();
  });
});
