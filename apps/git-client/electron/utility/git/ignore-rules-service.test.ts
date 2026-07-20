import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GitProcessRunner } from "./git-process";
import { IgnoreRulesService, MAX_IGNORE_RULE_BYTES } from "./ignore-rules-service";
import { RepositoryRegistry } from "./repository-registry";

const temporaryDirectories: string[] = [];

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

async function createService(): Promise<{
  readonly root: string;
  readonly service: IgnoreRulesService;
  readonly repositoryId: string;
}> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "git-client-ignore-"));
  temporaryDirectories.push(temporaryDirectory);
  const root = join(temporaryDirectory, "repository");
  await mkdir(root);
  git(root, "init", "--initial-branch=main");
  const registry = new RepositoryRegistry(new GitProcessRunner());
  const repository = await registry.open(root);
  return {
    root,
    service: new IgnoreRulesService(registry),
    repositoryId: repository.id,
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("IgnoreRulesService", () => {
  it("reads missing files as empty and atomically persists both fixed files", async () => {
    const { root, service, repositoryId } = await createService();
    await expect(service.read(repositoryId)).resolves.toEqual({
      gitignore: "",
      infoExclude: expect.stringContaining("git ls-files --others"),
    });

    await service.write(repositoryId, {
      gitignore: "dist/\n",
      infoExclude: ".cache/\n",
    });

    await expect(service.read(repositoryId)).resolves.toEqual({
      gitignore: "dist/\n",
      infoExclude: ".cache/\n",
    });
    await expect(readFile(join(root, ".gitignore"), "utf8")).resolves.toBe("dist/\n");
    await expect(readFile(join(root, ".git", "info", "exclude"), "utf8")).resolves.toBe(
      ".cache/\n",
    );
  });

  it("rejects NUL, oversized content, invalid UTF-8, and symbolic-link reads", async () => {
    const { root, service, repositoryId } = await createService();
    await expect(
      service.write(repositoryId, {
        gitignore: "bad\0rule",
        infoExclude: "",
      }),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(
      service.write(repositoryId, {
        gitignore: "x".repeat(MAX_IGNORE_RULE_BYTES + 1),
        infoExclude: "",
      }),
    ).rejects.toMatchObject({ code: "invalidInput" });

    await writeFile(join(root, ".gitignore"), Buffer.from([0xff, 0xfe]));
    await expect(service.read(repositoryId)).rejects.toMatchObject({
      code: "invalidInput",
    });

    const outside = join(root, "..", "outside-ignore");
    await writeFile(outside, "secret\n", "utf8");
    await rm(join(root, ".gitignore"));
    await symlink(outside, join(root, ".gitignore"));
    await expect(service.read(repositoryId)).rejects.toMatchObject({
      code: "invalidInput",
    });
  });

  it("replaces a destination symlink without modifying its target", async () => {
    const { root, service, repositoryId } = await createService();
    const outside = join(root, "..", "outside-ignore");
    await writeFile(outside, "do-not-touch\n", "utf8");
    await symlink(outside, join(root, ".gitignore"));

    await service.write(repositoryId, {
      gitignore: "safe\n",
      infoExclude: "",
    });

    await expect(readFile(outside, "utf8")).resolves.toBe("do-not-touch\n");
    await expect(readFile(join(root, ".gitignore"), "utf8")).resolves.toBe("safe\n");
  });
});
