import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ChangelistCommitOptions } from "../../../src/generated";
import type { RepositoryId } from "../../../src/shared/contracts/git-utility";
import {
  ChangelistService,
  MAX_CHANGELIST_MANIFEST_BYTES,
  type ChangelistRepositoryRegistryLike,
} from "./changelist-service";
import { GitProcessRunner } from "./git-process";
import {
  PatchProcessRunner,
  type PatchProcessOutcome,
  type PatchProcessRunnerLike,
  type PatchProcessSpec,
} from "./patch-service";
import { RepositoryRegistry } from "./repository-registry";

const temporaryDirectories: string[] = [];
const DEFAULT_OPTIONS: ChangelistCommitOptions = {
  message: "Commit changelist",
  amend: false,
  signOff: false,
  gpgSign: false,
};

interface Fixture {
  readonly root: string;
  readonly storageRoot: string;
  readonly repositoryId: RepositoryId;
  readonly service: ChangelistService;
}

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

function gitFails(cwd: string, ...args: readonly string[]): void {
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
  if (result.status === 0) {
    throw new Error(`git ${args.join(" ")} unexpectedly succeeded`);
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createFixture(
  runner: PatchProcessRunnerLike = new PatchProcessRunner(),
): Promise<Fixture> {
  const temporaryDirectory = await mkdtemp(
    join(tmpdir(), "git-client-changelist-"),
  );
  temporaryDirectories.push(temporaryDirectory);
  const root = join(temporaryDirectory, "repository");
  const storageRoot = join(temporaryDirectory, "app-data");
  await Promise.all([mkdir(root), mkdir(storageRoot)]);
  git(root, "init", "--initial-branch=main");
  git(root, "config", "user.name", "Git Client Test");
  git(root, "config", "user.email", "git-client@example.invalid");
  git(root, "config", "commit.gpgsign", "false");
  const registry = new RepositoryRegistry(new GitProcessRunner());
  const repository = await registry.open(root);
  return {
    root,
    storageRoot,
    repositoryId: repository.id,
    service: ChangelistService.of(registry, storageRoot, runner),
  };
}

async function writeBase(root: string): Promise<void> {
  await Promise.all([
    writeFile(join(root, "selected.txt"), "base selected\n", "utf8"),
    writeFile(join(root, "staged.txt"), "base staged\n", "utf8"),
    writeFile(join(root, "유니코드.txt"), "base unicode\n", "utf8"),
  ]);
  git(root, "add", "--", "selected.txt", "staged.txt", "유니코드.txt");
  git(root, "commit", "-m", "base");
}

function manifestPath(fixture: Fixture): string {
  return join(
    fixture.storageRoot,
    "changelists",
    `${fixture.repositoryId}.json`,
  );
}

async function indexBytes(root: string): Promise<Buffer> {
  const indexPath = git(root, "rev-parse", "--git-path", "index").trim();
  return readFile(join(root, indexPath));
}

function checksumPayload(payload: unknown): string {
  return createHash("sha256")
    .update(Buffer.from(JSON.stringify(payload), "utf8"))
    .digest("hex");
}

class CommitTerminalRunner implements PatchProcessRunnerLike {
  readonly #delegate = new PatchProcessRunner();
  readonly #terminal: "cancelled" | "outputLimit";

  constructor(terminal: "cancelled" | "outputLimit") {
    this.#terminal = terminal;
  }

  run(spec: PatchProcessSpec, signal?: AbortSignal): Promise<PatchProcessOutcome> {
    if (spec.args[0] !== "commit") return this.#delegate.run(spec, signal);
    if (this.#terminal === "cancelled") {
      return Promise.resolve({
        kind: "cancelled",
        reason: "requested",
        stdout: Buffer.alloc(0),
        stderr: Buffer.alloc(0),
        durationMs: 0,
      });
    }
    return Promise.resolve({
      kind: "failed",
      code: "outputLimit",
      message: "test output limit",
      exitCode: null,
      stdout: Buffer.alloc(0),
      stderr: Buffer.alloc(0),
      durationMs: 0,
    });
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("ChangelistService metadata", () => {
  it("implements the existing list/save/delete contract without inventing a persisted default", async () => {
    const fixture = await createFixture();

    await expect(fixture.service.list(fixture.repositoryId)).resolves.toEqual([]);
    const first = await fixture.service.save(
      fixture.repositoryId,
      null,
      "  Feature work  ",
      ["z.txt", "a.txt", "z.txt"],
    );
    expect(first).toMatchObject({
      repositoryId: fixture.repositoryId,
      name: "Feature work",
      paths: ["a.txt", "z.txt"],
    });

    const renamed = await fixture.service.save(
      fixture.repositoryId,
      first.id,
      "Renamed",
      ["a.txt"],
    );
    expect(renamed).toMatchObject({
      id: first.id,
      name: "Renamed",
      paths: ["a.txt"],
      createdAtMs: first.createdAtMs,
    });
    expect(renamed.updatedAtMs).toBeGreaterThanOrEqual(first.updatedAtMs);

    await fixture.service.delete(fixture.repositoryId, randomUUID());
    await expect(fixture.service.list(fixture.repositoryId)).resolves.toEqual([
      renamed,
    ]);
    await fixture.service.delete(fixture.repositoryId, first.id);
    await expect(fixture.service.list(fixture.repositoryId)).resolves.toEqual([]);
  });

  it("uses whole-path replacement for add/remove/move semantics and preserves duplicate assignment behavior", async () => {
    const fixture = await createFixture();
    const left = await fixture.service.save(
      fixture.repositoryId,
      null,
      "Left",
      ["a.txt", "move.txt"],
    );
    const right = await fixture.service.save(
      fixture.repositoryId,
      null,
      "Right",
      [],
    );

    await fixture.service.save(fixture.repositoryId, left.id, left.name, [
      "a.txt",
    ]);
    await fixture.service.save(fixture.repositoryId, right.id, right.name, [
      "move.txt",
      "new.txt",
    ]);
    const duplicate = await fixture.service.save(
      fixture.repositoryId,
      null,
      "Duplicate",
      ["move.txt"],
    );

    await expect(fixture.service.list(fixture.repositoryId)).resolves.toMatchObject([
      { id: left.id, paths: ["a.txt"] },
      { id: right.id, paths: ["move.txt", "new.txt"] },
      { id: duplicate.id, paths: ["move.txt"] },
    ]);
  });

  it("serializes concurrent same-repository saves without losing entries", async () => {
    const fixture = await createFixture();
    const saved = await Promise.all(
      Array.from({ length: 40 }, (_, index) =>
        fixture.service.save(
          fixture.repositoryId,
          null,
          `Change ${index}`,
          [`file-${index}.txt`],
        ),
      ),
    );

    const listed = await fixture.service.list(fixture.repositoryId);
    expect(listed).toHaveLength(40);
    expect(new Set(listed.map((entry) => entry.id))).toHaveLength(40);
    expect(new Set(saved.map((entry) => entry.id))).toEqual(
      new Set(listed.map((entry) => entry.id)),
    );
  });

  it.each([
    ["absolute", "/outside.txt"],
    ["parent", "../outside.txt"],
    ["non-normalized", "directory/../file.txt"],
    ["empty component", "directory//file.txt"],
  ])("rejects %s paths before persistence", async (_label, path) => {
    const fixture = await createFixture();
    await expect(
      fixture.service.save(fixture.repositoryId, null, "Unsafe", [path]),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(fixture.service.list(fixture.repositoryId)).resolves.toEqual([]);
  });

  it("fails closed for checksum damage and valid-checksum invariant damage", async () => {
    const fixture = await createFixture();
    await fixture.service.save(fixture.repositoryId, null, "Original", [
      "a.txt",
      "b.txt",
    ]);
    const path = manifestPath(fixture);
    const envelope = JSON.parse(await readFile(path, "utf8")) as {
      version: 1;
      repositoryId: string;
      changelists: Array<{
        name: string;
        paths: string[];
      }>;
      checksum: string;
    };
    const original = await readFile(path);

    envelope.changelists[0]!.name = "Tampered";
    await writeFile(path, JSON.stringify(envelope), "utf8");
    await expect(fixture.service.list(fixture.repositoryId)).rejects.toThrow(
      /checksum mismatch/u,
    );

    const restored = JSON.parse(original.toString("utf8")) as typeof envelope;
    restored.changelists[0]!.paths = ["b.txt", "a.txt"];
    const { checksum: _oldChecksum, ...payload } = restored;
    restored.checksum = checksumPayload(payload);
    await writeFile(path, JSON.stringify(restored), "utf8");
    await expect(fixture.service.list(fixture.repositoryId)).rejects.toThrow(
      /sorted and unique/u,
    );
  });

  it("rejects oversized and symlinked manifests and symlink-traversing storage roots", async () => {
    const fixture = await createFixture();
    await fixture.service.save(fixture.repositoryId, null, "Original", []);
    const path = manifestPath(fixture);
    const original = `${path}.original`;
    await rename(path, original);
    await symlink(original, path);
    await expect(fixture.service.list(fixture.repositoryId)).rejects.toThrow(
      /symbolic link/u,
    );

    await rm(path);
    await writeFile(path, Buffer.alloc(MAX_CHANGELIST_MANIFEST_BYTES + 1));
    await expect(fixture.service.list(fixture.repositoryId)).rejects.toMatchObject({
      code: "outputLimit",
    });

    const linkedRoot = join(dirname(fixture.storageRoot), "linked-app-data");
    await symlink(fixture.storageRoot, linkedRoot);
    const registry: ChangelistRepositoryRegistryLike = {
      get: (repositoryId) => ({
        id: repositoryId,
        name: "Repository",
        path: fixture.root,
        gitDirectory: join(fixture.root, ".git"),
        commonDirectory: join(fixture.root, ".git"),
        isBare: false,
        gitVersion: { major: 2, minor: 39, patch: 0, display: "git version 2.39.0" },
      }),
    };
    const linked = ChangelistService.of(registry, linkedRoot);
    await expect(linked.list(fixture.repositoryId)).rejects.toThrow(/symbolic link/u);
  });

  it("honors an already-aborted signal without creating metadata", async () => {
    const fixture = await createFixture();
    const cancellation = new AbortController();
    cancellation.abort("requested");
    await expect(
      fixture.service.save(
        fixture.repositoryId,
        null,
        "Cancelled",
        [],
        cancellation.signal,
      ),
    ).rejects.toThrow(/cancelled/u);
    expect(await pathExists(manifestPath(fixture))).toBe(false);
  });
});

describe("ChangelistService selected commits", () => {
  it("commits selected worktree and untracked bytes while preserving unrelated staged entries", async () => {
    const fixture = await createFixture();
    await writeBase(fixture.root);
    await writeFile(join(fixture.root, "selected.txt"), "selected staged\n", "utf8");
    git(fixture.root, "add", "--", "selected.txt");
    await writeFile(join(fixture.root, "selected.txt"), "selected worktree\n", "utf8");
    await writeFile(join(fixture.root, "staged.txt"), "unrelated staged\n", "utf8");
    git(fixture.root, "add", "--", "staged.txt");
    await writeFile(join(fixture.root, "유니코드.txt"), "unicode worktree\n", "utf8");
    const shellPath = "new;touch injected.txt";
    await writeFile(join(fixture.root, shellPath), Buffer.from([0x00, 0x41, 0xff]));
    const unrelatedIndexBefore = git(
      fixture.root,
      "ls-files",
      "--stage",
      "--",
      "staged.txt",
    );
    const changelist = await fixture.service.save(
      fixture.repositoryId,
      null,
      "Selected",
      ["selected.txt", shellPath, "유니코드.txt"],
    );

    const result = await fixture.service.commit(
      fixture.repositoryId,
      changelist.id,
      { ...DEFAULT_OPTIONS, message: "Selected files", signOff: true },
    );

    expect(result).toEqual({
      changelistId: changelist.id,
      commitOid: git(fixture.root, "rev-parse", "HEAD").trim(),
    });
    expect(git(fixture.root, "show", "HEAD:selected.txt")).toBe(
      "selected worktree\n",
    );
    expect(git(fixture.root, "show", "HEAD:유니코드.txt")).toBe(
      "unicode worktree\n",
    );
    expect(
      Buffer.from(
        spawnSync("git", ["show", `HEAD:${shellPath}`], {
          cwd: fixture.root,
          shell: false,
        }).stdout,
      ),
    ).toEqual(Buffer.from([0x00, 0x41, 0xff]));
    expect(git(fixture.root, "show", "HEAD:staged.txt")).toBe("base staged\n");
    expect(git(fixture.root, "show", ":staged.txt")).toBe("unrelated staged\n");
    expect(
      git(fixture.root, "ls-files", "--stage", "--", "staged.txt"),
    ).toBe(unrelatedIndexBefore);
    expect(git(fixture.root, "status", "--short")).toBe("M  staged.txt\n");
    expect(git(fixture.root, "log", "-1", "--pretty=%B")).toContain(
      "Signed-off-by: Git Client Test <git-client@example.invalid>",
    );
    expect(await pathExists(join(fixture.root, "injected.txt"))).toBe(false);
    await expect(fixture.service.list(fixture.repositoryId)).resolves.toEqual([]);
  });

  it("rolls back intent-to-add and retains metadata when a hook rejects the commit", async () => {
    const fixture = await createFixture();
    await writeBase(fixture.root);
    await writeFile(join(fixture.root, "staged.txt"), "staged\n", "utf8");
    git(fixture.root, "add", "--", "staged.txt");
    await writeFile(join(fixture.root, "new.txt"), "new\n", "utf8");
    const changelist = await fixture.service.save(
      fixture.repositoryId,
      null,
      "Rejected",
      ["new.txt"],
    );
    const headBefore = git(fixture.root, "rev-parse", "HEAD");
    const indexBefore = await indexBytes(fixture.root);
    const hook = join(fixture.root, ".git", "hooks", "pre-commit");
    await writeFile(hook, "#!/bin/sh\nexit 1\n", "utf8");
    await chmod(hook, 0o755);

    await expect(
      fixture.service.commit(fixture.repositoryId, changelist.id, DEFAULT_OPTIONS),
    ).rejects.toMatchObject({ code: "commandFailed" });

    expect(git(fixture.root, "rev-parse", "HEAD")).toBe(headBefore);
    await expect(indexBytes(fixture.root)).resolves.toEqual(indexBefore);
    expect(git(fixture.root, "status", "--short")).toBe(
      "M  staged.txt\n?? new.txt\n",
    );
    await expect(fixture.service.list(fixture.repositoryId)).resolves.toMatchObject([
      { id: changelist.id, paths: ["new.txt"] },
    ]);
  });

  it.each(["cancelled", "outputLimit"] as const)(
    "restores the exact index and manifest after a %s Git terminal outcome",
    async (terminal) => {
      const fixture = await createFixture(new CommitTerminalRunner(terminal));
      await writeBase(fixture.root);
      await writeFile(join(fixture.root, "new.txt"), "new\n", "utf8");
      const changelist = await fixture.service.save(
        fixture.repositoryId,
        null,
        "Terminal failure",
        ["new.txt"],
      );
      const indexBefore = await indexBytes(fixture.root);
      const manifestBefore = await readFile(manifestPath(fixture));
      const headBefore = git(fixture.root, "rev-parse", "HEAD");

      await expect(
        fixture.service.commit(
          fixture.repositoryId,
          changelist.id,
          DEFAULT_OPTIONS,
        ),
      ).rejects.toMatchObject({
        code: terminal === "outputLimit" ? "outputLimit" : "commandFailed",
      });

      await expect(indexBytes(fixture.root)).resolves.toEqual(indexBefore);
      await expect(readFile(manifestPath(fixture))).resolves.toEqual(manifestBefore);
      expect(git(fixture.root, "rev-parse", "HEAD")).toBe(headBefore);
      expect(git(fixture.root, "status", "--short")).toBe("?? new.txt\n");
    },
  );

  it("rejects a symlinked Git index and a repository root replaced by a symlink", async () => {
    const fixture = await createFixture();
    await writeBase(fixture.root);
    await writeFile(join(fixture.root, "selected.txt"), "changed\n", "utf8");
    const changelist = await fixture.service.save(
      fixture.repositoryId,
      null,
      "Unsafe repository",
      ["selected.txt"],
    );
    const index = join(fixture.root, ".git", "index");
    const realIndex = join(fixture.root, ".git", "index.real");
    await rename(index, realIndex);
    await symlink(realIndex, index);
    await expect(
      fixture.service.commit(fixture.repositoryId, changelist.id, DEFAULT_OPTIONS),
    ).rejects.toThrow(/symbolic link/u);

    await rm(index);
    await rename(realIndex, index);
    const moved = `${fixture.root}.moved`;
    await rename(fixture.root, moved);
    await mkdir(fixture.root);
    await rm(fixture.root, { recursive: true });
    await symlink(moved, fixture.root);
    await expect(
      fixture.service.commit(fixture.repositoryId, changelist.id, DEFAULT_OPTIONS),
    ).rejects.toThrow(/symbolic link/u);
  });

  it("leaves HEAD, index, and metadata untouched for a clean selected path", async () => {
    const fixture = await createFixture();
    await writeBase(fixture.root);
    const changelist = await fixture.service.save(
      fixture.repositoryId,
      null,
      "No changes",
      ["selected.txt"],
    );
    const headBefore = git(fixture.root, "rev-parse", "HEAD");
    const indexBefore = await indexBytes(fixture.root);
    const manifestBefore = await readFile(manifestPath(fixture));

    await expect(
      fixture.service.commit(fixture.repositoryId, changelist.id, DEFAULT_OPTIONS),
    ).rejects.toMatchObject({ code: "commandFailed" });

    expect(git(fixture.root, "rev-parse", "HEAD")).toBe(headBefore);
    await expect(indexBytes(fixture.root)).resolves.toEqual(indexBefore);
    await expect(readFile(manifestPath(fixture))).resolves.toEqual(manifestBefore);
  });

  it("validates ids, messages, options, and empty changelists before Git mutation", async () => {
    const fixture = await createFixture();
    const empty = await fixture.service.save(
      fixture.repositoryId,
      null,
      "Empty",
      [],
    );
    await expect(
      fixture.service.commit(fixture.repositoryId, empty.id, DEFAULT_OPTIONS),
    ).rejects.toThrow(/no files/u);
    await expect(
      fixture.service.commit(fixture.repositoryId, "not-a-uuid", DEFAULT_OPTIONS),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(
      fixture.service.commit(fixture.repositoryId, empty.id, {
        ...DEFAULT_OPTIONS,
        message: " \n ",
      }),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(
      fixture.service.delete(fixture.repositoryId, "../../manifest"),
    ).rejects.toMatchObject({ code: "invalidInput" });
    gitFails(fixture.root, "show", "HEAD:never-created.txt");
  });
});
