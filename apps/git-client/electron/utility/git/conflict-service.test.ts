import { spawnSync } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  GitConflictService,
  MAX_CONFLICT_TEXT_BYTES,
  MAX_CONFLICT_TEXT_LINES,
} from "./conflict-service";
import { GitProcessRunner } from "./git-process";
import { RepositoryRegistry } from "./repository-registry";

const temporaryDirectories: string[] = [];

type ConflictOperation = "merge" | "rebase" | "cherry-pick" | "revert";

interface ConflictFixture {
  readonly root: string;
  readonly repositoryId: string;
  readonly service: GitConflictService;
}

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
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout;
}

function gitFails(cwd: string, ...args: readonly string[]): void {
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
  if (result.status === 0) throw new Error(`git ${args.join(" ")} unexpectedly succeeded`);
}

function gitBytes(cwd: string, ...args: readonly string[]): Buffer {
  const result = spawnSync("git", args, {
    cwd,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      GIT_OPTIONAL_LOCKS: "0",
      LC_ALL: "C",
    },
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.toString("utf8") || `git ${args.join(" ")} failed`);
  }
  return result.stdout;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createRepository(): Promise<string> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "git-client-conflict-"));
  temporaryDirectories.push(temporaryDirectory);
  const root = join(temporaryDirectory, "repository");
  await mkdir(root);
  git(root, "init", "--initial-branch=main");
  git(root, "config", "user.name", "Git Client Test");
  git(root, "config", "user.email", "git-client@example.invalid");
  git(root, "config", "commit.gpgsign", "false");
  git(root, "config", "rerere.enabled", "false");
  return root;
}

async function openFixture(root: string): Promise<ConflictFixture> {
  const registry = new RepositoryRegistry(new GitProcessRunner());
  const repository = await registry.open(root);
  return {
    root,
    repositoryId: repository.id,
    service: GitConflictService.of(registry),
  };
}

async function createMergeConflict(
  path = "conflict.txt",
  contents: {
    readonly base: string | Uint8Array;
    readonly local: string | Uint8Array;
    readonly remote: string | Uint8Array;
  } = { base: "base\n", local: "local\n", remote: "remote\n" },
): Promise<ConflictFixture> {
  const root = await createRepository();
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), contents.base);
  git(root, "add", "--", path);
  git(root, "commit", "-m", "base");
  git(root, "checkout", "-b", "side");
  await writeFile(join(root, path), contents.remote);
  git(root, "add", "--", path);
  git(root, "commit", "-m", "remote");
  git(root, "checkout", "main");
  await writeFile(join(root, path), contents.local);
  git(root, "add", "--", path);
  git(root, "commit", "-m", "local");
  gitFails(root, "merge", "side");
  return openFixture(root);
}

async function createOperationConflict(operation: ConflictOperation): Promise<ConflictFixture> {
  if (operation === "merge") return createMergeConflict();

  const root = await createRepository();
  const path = "conflict.txt";
  await writeFile(join(root, path), "base\n", "utf8");
  git(root, "add", "--", path);
  git(root, "commit", "-m", "base");

  if (operation === "revert") {
    await writeFile(join(root, path), "change to revert\n", "utf8");
    git(root, "commit", "-am", "change to revert");
    const revertedCommit = git(root, "rev-parse", "HEAD").trim();
    await writeFile(join(root, path), "newer change\n", "utf8");
    git(root, "commit", "-am", "newer change");
    gitFails(root, "revert", "--no-edit", revertedCommit);
    return openFixture(root);
  }

  git(root, "checkout", "-b", "topic");
  await writeFile(join(root, path), "topic\n", "utf8");
  git(root, "commit", "-am", "topic");
  const topicCommit = git(root, "rev-parse", "HEAD").trim();
  git(root, "checkout", "main");
  await writeFile(join(root, path), "main\n", "utf8");
  git(root, "commit", "-am", "main");

  if (operation === "cherry-pick") {
    gitFails(root, "cherry-pick", topicCommit);
  } else {
    git(root, "checkout", "topic");
    gitFails(root, "rebase", "main");
  }

  return openFixture(root);
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("GitConflictService", () => {
  it("lists, reads, writes, and optionally stages all three text conflict stages", async () => {
    const { repositoryId, root, service } = await createMergeConflict();

    await expect(service.list(repositoryId)).resolves.toEqual([
      {
        path: "conflict.txt",
        baseOid: expect.stringMatching(/^[0-9a-f]{40,64}$/u),
        localOid: expect.stringMatching(/^[0-9a-f]{40,64}$/u),
        remoteOid: expect.stringMatching(/^[0-9a-f]{40,64}$/u),
        binary: false,
      },
    ]);
    await expect(service.read(repositoryId, "conflict.txt")).resolves.toMatchObject({
      path: "conflict.txt",
      base: "base\n",
      local: "local\n",
      remote: "remote\n",
      binary: false,
      localLabel: "Local (ours)",
      remoteLabel: "Remote (theirs)",
    });

    await service.write(repositoryId, "conflict.txt", "reviewed\n", false);
    await expect(readFile(join(root, "conflict.txt"), "utf8")).resolves.toBe("reviewed\n");
    expect(git(root, "diff", "--name-only", "--diff-filter=U", "-z")).toBe("conflict.txt\0");

    await service.write(repositoryId, "conflict.txt", "resolved\n", true);
    await expect(service.list(repositoryId)).resolves.toEqual([]);
    expect(git(root, "show", ":conflict.txt")).toBe("resolved\n");
  });

  it("resolves either binary side byte-for-byte without evaluating the path in a shell", async () => {
    const path = "binary;touch injected.bin";
    const { repositoryId, root, service } = await createMergeConflict(path, {
      base: Buffer.from([0x00, 0x62, 0x61, 0x73, 0x65, 0xff]),
      local: Buffer.from([0x00, 0x6c, 0x6f, 0x63, 0x61, 0x6c, 0xfe]),
      remote: Buffer.from([0x00, 0x72, 0x65, 0x6d, 0x6f, 0x74, 0x65, 0xfd]),
    });
    const ours = gitBytes(root, "show", `:2:${path}`);
    const theirs = gitBytes(root, "show", `:3:${path}`);

    await expect(service.list(repositoryId)).resolves.toMatchObject([{ path, binary: true }]);
    await expect(service.read(repositoryId, path)).resolves.toMatchObject({
      path,
      base: null,
      local: null,
      remote: null,
      result: null,
      binary: true,
    });

    await service.resolveBinary(repositoryId, path, "ours");
    await expect(readFile(join(root, path))).resolves.toEqual(ours);
    expect(gitBytes(root, "show", `:0:${path}`)).toEqual(ours);
    await expect(pathExists(join(root, "injected.bin"))).resolves.toBe(false);

    git(root, "merge", "--abort");
    gitFails(root, "merge", "side");
    await service.resolveBinary(repositoryId, path, "theirs");
    await expect(readFile(join(root, path))).resolves.toEqual(theirs);
    expect(gitBytes(root, "show", `:0:${path}`)).toEqual(theirs);
    await expect(pathExists(join(root, "injected.bin"))).resolves.toBe(false);
  });

  it("enforces the 5 MiB, 50,000-line, and NUL text boundaries before replacing a file", async () => {
    const { repositoryId, root, service } = await createMergeConflict();
    const destination = join(root, "conflict.txt");
    const maximumBytes = "x".repeat(MAX_CONFLICT_TEXT_BYTES);

    await service.write(repositoryId, "conflict.txt", maximumBytes, false);
    await expect(readFile(destination, "utf8")).resolves.toBe(maximumBytes);
    await expect(
      service.write(repositoryId, "conflict.txt", `${maximumBytes}x`, false),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(readFile(destination, "utf8")).resolves.toBe(maximumBytes);

    const maximumLines = "line\n".repeat(MAX_CONFLICT_TEXT_LINES);
    await service.write(repositoryId, "conflict.txt", maximumLines, false);
    await expect(readFile(destination, "utf8")).resolves.toBe(maximumLines);
    await expect(
      service.write(repositoryId, "conflict.txt", `${maximumLines}extra\n`, false),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(
      service.write(repositoryId, "conflict.txt", "unsafe\0result", false),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(readFile(destination, "utf8")).resolves.toBe(maximumLines);
  });

  it("classifies conflict stages beyond the byte or line boundary as binary", async () => {
    const oversizedShared = `${"x".repeat(105)}\n`.repeat(MAX_CONFLICT_TEXT_LINES - 1);
    const oversized = await createMergeConflict("oversized.txt", {
      base: `base\n${oversizedShared}`,
      local: `local\n${oversizedShared}`,
      remote: `remote\n${oversizedShared}`,
    });
    expect(Buffer.byteLength(`base\n${oversizedShared}`, "utf8")).toBeGreaterThan(
      MAX_CONFLICT_TEXT_BYTES,
    );
    await expect(oversized.service.list(oversized.repositoryId)).resolves.toMatchObject([
      { path: "oversized.txt", binary: true },
    ]);
    await expect(
      oversized.service.read(oversized.repositoryId, "oversized.txt"),
    ).resolves.toMatchObject({ base: null, local: null, remote: null, binary: true });

    const excessiveLinesShared = "shared\n".repeat(MAX_CONFLICT_TEXT_LINES);
    const excessiveLines = await createMergeConflict("too-many-lines.txt", {
      base: `base\n${excessiveLinesShared}`,
      local: `local\n${excessiveLinesShared}`,
      remote: `remote\n${excessiveLinesShared}`,
    });
    expect(Buffer.byteLength(`base\n${excessiveLinesShared}`, "utf8")).toBeLessThan(
      MAX_CONFLICT_TEXT_BYTES,
    );
    await expect(excessiveLines.service.list(excessiveLines.repositoryId)).resolves.toMatchObject([
      { path: "too-many-lines.txt", binary: true },
    ]);
    await expect(
      excessiveLines.service.read(excessiveLines.repositoryId, "too-many-lines.txt"),
    ).resolves.toMatchObject({ base: null, local: null, remote: null, binary: true });
  });

  it("rejects traversal, direct symlinks, and symlinked parent escapes without changing outside files", async () => {
    const path = "nested/conflict.txt";
    const { repositoryId, root, service } = await createMergeConflict(path);
    const temporaryDirectory = dirname(root);
    const outsideDirectory = join(temporaryDirectory, "outside");
    const outsideFile = join(outsideDirectory, "conflict.txt");
    await mkdir(outsideDirectory);
    await writeFile(outsideFile, "outside\n", "utf8");

    await expect(
      service.write(repositoryId, "../outside/conflict.txt", "escaped\n", false),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(service.read(repositoryId, "../outside/conflict.txt")).rejects.toMatchObject({
      code: "invalidInput",
    });
    await expect(
      service.resolveBinary(repositoryId, "../outside/conflict.txt", "ours"),
    ).rejects.toMatchObject({ code: "invalidInput" });

    const destination = join(root, path);
    await rm(destination);
    await symlink(outsideFile, destination);
    await expect(service.read(repositoryId, path)).rejects.toMatchObject({
      code: "invalidInput",
    });
    await expect(service.write(repositoryId, path, "escaped\n", false)).rejects.toMatchObject({
      code: "invalidInput",
    });

    await rm(destination);
    await rm(dirname(destination), { recursive: true });
    await symlink(outsideDirectory, dirname(destination));
    await expect(service.read(repositoryId, path)).rejects.toMatchObject({
      code: "invalidInput",
    });
    await expect(service.write(repositoryId, path, "escaped\n", false)).rejects.toMatchObject({
      code: "invalidInput",
    });
    await expect(readFile(outsideFile, "utf8")).resolves.toBe("outside\n");
  });

  it.each([
    {
      operation: "merge" as const,
      localLabel: "Local (ours)",
      remoteLabel: "Remote (theirs)",
    },
    {
      operation: "rebase" as const,
      localLabel: "Rebased onto (ours)",
      remoteLabel: "Commit being rebased (theirs)",
    },
    {
      operation: "cherry-pick" as const,
      localLabel: "Current branch (ours)",
      remoteLabel: "Cherry-picked commit (theirs)",
    },
    {
      operation: "revert" as const,
      localLabel: "Current branch (ours)",
      remoteLabel: "Reverted commit (theirs)",
    },
  ])("uses operation-aware labels during $operation conflicts", async (scenario) => {
    const { repositoryId, service } = await createOperationConflict(scenario.operation);

    await expect(service.read(repositoryId, "conflict.txt")).resolves.toMatchObject({
      localLabel: scenario.localLabel,
      remoteLabel: scenario.remoteLabel,
    });
  });
});
