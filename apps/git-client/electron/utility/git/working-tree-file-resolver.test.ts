import { spawnSync } from "node:child_process";
import type { Stats } from "node:fs";
import {
  lstat,
  mkdir,
  mkdtemp,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GitProcessRunner } from "./git-process";
import { RepositoryRegistry } from "./repository-registry";
import { WorkingTreeFileResolver, type WorkingTreeFileSystem } from "./working-tree-file-resolver";

const temporaryDirectories: string[] = [];

function git(cwd: string, ...args: readonly string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      GIT_OPTIONAL_LOCKS: "0",
      GIT_PAGER: "cat",
      LC_ALL: "C",
    },
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  }
  return result.stdout;
}

async function createRepository(): Promise<{
  readonly root: string;
  readonly registry: RepositoryRegistry;
}> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "git-client-open-file-"));
  temporaryDirectories.push(temporaryDirectory);
  const root = join(temporaryDirectory, "repository");
  await mkdir(root);
  git(root, "init", "--initial-branch=main");
  git(root, "config", "user.name", "Git Client Test");
  git(root, "config", "user.email", "git-client@example.invalid");
  await writeFile(join(root, "tracked.txt"), "tracked\n", "utf8");
  git(root, "add", "--", "tracked.txt");
  git(root, "commit", "-m", "initial");
  return {
    root,
    registry: new RepositoryRegistry(new GitProcessRunner()),
  };
}

class ReplacingFileSystem implements WorkingTreeFileSystem {
  readonly #target: string;
  readonly #replacement: string;
  readonly #retired: string;
  #targetStatCount = 0;

  constructor(target: string, replacement: string, retired: string) {
    this.#target = target;
    this.#replacement = replacement;
    this.#retired = retired;
  }

  realpath(path: string): Promise<string> {
    return realpath(path);
  }

  lstat(path: string): Promise<Stats> {
    return lstat(path);
  }

  async stat(path: string): Promise<Stats> {
    if (path === this.#target) {
      this.#targetStatCount += 1;
      if (this.#targetStatCount === 2) {
        await rename(this.#target, this.#retired);
        await rename(this.#replacement, this.#target);
      }
    }
    return stat(path);
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("WorkingTreeFileResolver", () => {
  it("returns canonical absolute paths only for regular files inside the repository", async () => {
    const { root, registry } = await createRepository();
    const record = await registry.open(root);
    const resolver = new WorkingTreeFileResolver(registry);
    await mkdir(join(root, "nested"));
    await symlink("../tracked.txt", join(root, "nested", "inside-link"));

    await expect(resolver.resolve(record.id, "tracked.txt")).resolves.toBe(
      await realpath(join(root, "tracked.txt")),
    );
    await expect(resolver.resolve(record.id, "nested/inside-link")).resolves.toBe(
      await realpath(join(root, "tracked.txt")),
    );
  });

  it("rejects escape links, directories, missing paths, traversal, null bytes, and option-like paths", async () => {
    const { root, registry } = await createRepository();
    const record = await registry.open(root);
    const resolver = new WorkingTreeFileResolver(registry);
    const outside = join(root, "..", "outside.txt");
    await writeFile(outside, "outside\n", "utf8");
    await symlink(outside, join(root, "escape-link"));
    await mkdir(join(root, "directory"));
    await writeFile(join(root, "--help"), "option\n", "utf8");

    for (const path of [
      "escape-link",
      "directory",
      "missing.txt",
      "../outside.txt",
      "unsafe\0name",
      "--help",
    ]) {
      await expect(resolver.resolve(record.id, path)).rejects.toMatchObject({
        code: "invalidInput",
      });
    }
  });

  it("rejects a file replaced between canonicalization and identity verification", async () => {
    const { root, registry } = await createRepository();
    const record = await registry.open(root);
    const target = await realpath(join(root, "tracked.txt"));
    const replacement = join(root, "replacement.txt");
    const retired = join(root, "retired.txt");
    await writeFile(replacement, "replacement\n", "utf8");
    const resolver = new WorkingTreeFileResolver(
      registry,
      new ReplacingFileSystem(target, replacement, retired),
    );

    await expect(resolver.resolve(record.id, "tracked.txt")).rejects.toMatchObject({
      code: "invalidInput",
      message: expect.stringContaining("changed"),
    });
  });
});
