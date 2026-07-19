import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { FileSource } from "../../../src/shared/contracts/git-utility";
import { GitProcessRunner } from "./git-process";
import { RepositoryRegistry } from "./repository-registry";
import { SubmoduleDiffService, parseNestedSubmoduleStatus } from "./submodule-diff-service";

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
  return result.stdout.trim();
}

function configureRepository(path: string): void {
  git(path, "init", "--initial-branch=main");
  git(path, "config", "user.name", "Git Client Test");
  git(path, "config", "user.email", "git-client@example.invalid");
}

async function createNestedSubmoduleFixture(): Promise<{
  readonly root: string;
  readonly checkout: string;
  readonly nestedCheckout: string;
  readonly firstOid: string;
  readonly secondOid: string;
  readonly nestedOid: string;
  readonly registry: RepositoryRegistry;
}> {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "git-client-submodule-foundation-"));
  temporaryDirectories.push(temporaryDirectory);
  const nested = join(temporaryDirectory, "nested-origin");
  const child = join(temporaryDirectory, "child-origin");
  const root = join(temporaryDirectory, "parent");
  await Promise.all([mkdir(nested), mkdir(child), mkdir(root)]);

  configureRepository(nested);
  await writeFile(join(nested, "nested.txt"), "nested\n", "utf8");
  git(nested, "add", "--", "nested.txt");
  git(nested, "commit", "-m", "nested commit");
  const nestedOid = git(nested, "rev-parse", "HEAD");

  configureRepository(child);
  git(child, "-c", "protocol.file.allow=always", "submodule", "add", nested, "deps/nested module");
  await writeFile(join(child, "child.txt"), "first\n", "utf8");
  git(child, "add", "--all");
  git(child, "commit", "-m", "first child commit");
  const firstOid = git(child, "rev-parse", "HEAD");
  await writeFile(join(child, "child.txt"), "second\n", "utf8");
  git(child, "commit", "-am", "second child commit");
  const secondOid = git(child, "rev-parse", "HEAD");

  configureRepository(root);
  git(root, "-c", "protocol.file.allow=always", "submodule", "add", child, "modules/한글 module");
  const checkout = join(root, "modules", "한글 module");
  git(checkout, "checkout", firstOid);
  git(root, "add", "--all");
  git(root, "commit", "-m", "add child at first commit");
  git(checkout, "checkout", secondOid);
  git(root, "-c", "protocol.file.allow=always", "submodule", "update", "--init", "--recursive");
  git(checkout, "checkout", secondOid);
  const nestedCheckout = join(checkout, "deps", "nested module");
  await writeFile(join(checkout, "child.txt"), "dirty child\n", "utf8");
  await writeFile(join(nestedCheckout, "nested.txt"), "dirty nested\n", "utf8");

  return {
    root,
    checkout,
    nestedCheckout,
    firstOid,
    secondOid,
    nestedOid,
    registry: new RepositoryRegistry(new GitProcessRunner()),
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("SubmoduleDiffService", () => {
  it("loads gitlink OIDs, subjects, dirty worktree state, and recursive submodule metadata", async () => {
    const fixture = await createNestedSubmoduleFixture();
    const record = await fixture.registry.open(fixture.root);
    const service = new SubmoduleDiffService(fixture.registry);

    const result = await service.loadSubmoduleDiff(
      record.id,
      { kind: "index" },
      { kind: "workingTree" },
      "modules/한글 module",
    );

    expect(result.diff).toEqual({
      path: "modules/한글 module",
      beforeOid: fixture.firstOid,
      afterOid: fixture.secondOid,
      beforeSubject: "first child commit",
      afterSubject: "second child commit",
      ahead: 1,
      behind: 0,
    });
    expect(result.worktree).toEqual({
      present: true,
      initialized: true,
      headOid: fixture.secondOid,
      branch: null,
      detached: true,
      dirty: true,
    });
    expect(result.nestedSubmodules).toEqual([
      expect.objectContaining({
        path: "deps/nested module",
        oid: fixture.nestedOid,
        status: "clean",
        initialized: true,
        dirty: true,
      }),
    ]);

    await expect(
      service.loadSubmoduleDiff(
        record.id,
        { kind: "revision", revision: "HEAD" },
        { kind: "workingTree" },
        "modules/한글 module",
      ),
    ).resolves.toMatchObject({
      diff: {
        beforeOid: fixture.firstOid,
        afterOid: fixture.secondOid,
      },
    });
  });

  it("rejects submodule symlink escapes and invalid FileSource revisions", async () => {
    const fixture = await createNestedSubmoduleFixture();
    const record = await fixture.registry.open(fixture.root);
    const service = new SubmoduleDiffService(fixture.registry);
    const outside = join(fixture.root, "..", "outside-repository");
    await mkdir(outside);
    configureRepository(outside);
    await symlink(outside, join(fixture.root, "outside-link"));

    await expect(
      service.loadSubmoduleDiff(
        record.id,
        { kind: "workingTree" },
        { kind: "index" },
        "outside-link",
      ),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(
      service.loadSubmoduleDiff(
        record.id,
        { kind: "revision", revision: "--all" } as FileSource,
        { kind: "index" },
        "modules/한글 module",
      ),
    ).rejects.toMatchObject({ code: "invalidInput" });
  });
});

describe("parseNestedSubmoduleStatus", () => {
  it("preserves paths with spaces and rejects malformed metadata", () => {
    const oid = "a".repeat(40);
    expect(parseNestedSubmoduleStatus(` ${oid} deps/space module (heads/main)\n`)).toEqual([
      {
        path: "deps/space module",
        oid,
        branch: "heads/main",
        status: "clean",
        initialized: true,
      },
    ]);
    expect(() => parseNestedSubmoduleStatus(`?${oid} invalid\n`)).toThrow(
      expect.objectContaining({ code: "commandFailed" }),
    );
  });
});
