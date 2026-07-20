import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { v5 as uuidV5 } from "uuid";
import { afterEach, describe, expect, it } from "vitest";
import type {
  GitFailureCode,
  RepositoryId,
  RepositoryRecord,
} from "../../../src/shared/contracts/git-utility";
import { GitUtilityError } from "./git-error";
import {
  PatchProcessRunner,
  type PatchProcessOutcome,
  type PatchProcessRunnerLike,
  type PatchProcessSpec,
} from "./patch-service";
import { MAX_SHELF_PATCH_BYTES, ShelfService } from "./shelf-service";

const temporaryDirectories: string[] = [];
const GIT_ENVIRONMENT = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_PAGER: "cat",
  GIT_OPTIONAL_LOCKS: "0",
  LC_ALL: "C",
};

function gitBytes(cwd: string, ...args: readonly string[]): Buffer {
  const result = spawnSync("git", args, {
    cwd,
    env: GIT_ENVIRONMENT,
    encoding: "buffer",
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr.toString("utf8") || `git ${args.join(" ")} failed`);
  }
  return result.stdout;
}

function git(cwd: string, ...args: readonly string[]): string {
  return gitBytes(cwd, ...args).toString("utf8");
}

async function temporaryDirectory(prefix = "git-client-shelf-"): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

async function createRepository(): Promise<string> {
  const root = await temporaryDirectory();
  const repository = join(root, "repository");
  await mkdir(repository);
  git(repository, "init", "--initial-branch=main");
  git(repository, "config", "user.name", "Shelf Test");
  git(repository, "config", "user.email", "shelf@example.invalid");
  await writeFile(join(repository, "tracked.txt"), "base\n", "utf8");
  git(repository, "add", "--", "tracked.txt");
  git(repository, "commit", "-m", "base");
  return realpath(repository);
}

function repositoryRecord(path: string): RepositoryRecord {
  return {
    id: uuidV5(path, uuidV5.URL) as RepositoryId,
    name: "repository",
    path,
    gitDirectory: join(path, ".git"),
    commonDirectory: join(path, ".git"),
    isBare: false,
    gitVersion: { major: 2, minor: 50, patch: 1, display: "git version 2.50.1" },
  };
}

function registry(record: RepositoryRecord): Readonly<{ get(id: RepositoryId): RepositoryRecord }> {
  return {
    get(id) {
      if (id !== record.id)
        throw new GitUtilityError("repositoryNotOpen", "Repository is not open");
      return record;
    },
  };
}

function completed(stdout = Buffer.alloc(0)): PatchProcessOutcome {
  return { kind: "completed", exitCode: 0, stdout, stderr: Buffer.alloc(0), durationMs: 1 };
}

function failed(
  code: GitFailureCode,
  message: string,
  stderr = Buffer.alloc(0),
): PatchProcessOutcome {
  return {
    kind: "failed",
    code,
    message,
    exitCode: 1,
    stdout: Buffer.alloc(0),
    stderr,
    durationMs: 1,
  };
}

class RecordingRunner implements PatchProcessRunnerLike {
  readonly specs: PatchProcessSpec[] = [];
  readonly signals: Array<AbortSignal | undefined> = [];
  readonly #outcomes: PatchProcessOutcome[];

  constructor(outcomes: readonly PatchProcessOutcome[]) {
    this.#outcomes = [...outcomes];
  }

  async run(spec: PatchProcessSpec, signal?: AbortSignal): Promise<PatchProcessOutcome> {
    this.specs.push(spec);
    this.signals.push(signal);
    const outcome = this.#outcomes.shift();
    if (outcome === undefined) throw new Error("Missing fake shelf-process outcome");
    return outcome;
  }
}

function checksum(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("ShelfService", () => {
  it("round-trips staged, worktree, and byte-exact untracked layers through a reusable shelf", async () => {
    const repository = await createRepository();
    const record = repositoryRecord(repository);
    const storageRoot = join(await temporaryDirectory(), "profile");
    await mkdir(storageRoot);
    await writeFile(join(repository, "tracked.txt"), "staged\n", "utf8");
    git(repository, "add", "--", "tracked.txt");
    await writeFile(join(repository, "tracked.txt"), "worktree\n", "utf8");
    const untrackedPath = "새 파일.bin";
    const untrackedBytes = Buffer.from([0, 1, 2, 0xff, 0x0a, 0x41]);
    await writeFile(join(repository, untrackedPath), untrackedBytes);
    const expectedIndexPatch = gitBytes(
      repository,
      "diff",
      "--binary",
      "--full-index",
      "--no-color",
      "--cached",
      "--",
      "tracked.txt",
      untrackedPath,
    );
    const expectedWorktreePatch = gitBytes(
      repository,
      "diff",
      "--binary",
      "--full-index",
      "--no-color",
      "--",
      "tracked.txt",
      untrackedPath,
    );
    const service = new ShelfService(registry(record), storageRoot, new PatchProcessRunner());

    const entry = await service.create(record.id, "layered changes", [
      "tracked.txt",
      untrackedPath,
    ]);
    const directory = join(storageRoot, "shelves", record.id, entry.id);

    expect(await readFile(join(directory, "index.patch"))).toEqual(expectedIndexPatch);
    expect(await readFile(join(directory, "worktree.patch"))).toEqual(expectedWorktreePatch);
    expect(await readFile(join(directory, "untracked", untrackedPath))).toEqual(untrackedBytes);
    expect(entry.files).toEqual([
      { path: "tracked.txt", checksum: "", untracked: false },
      { path: untrackedPath, checksum: checksum(untrackedBytes), untracked: true },
    ]);
    expect(git(repository, "status", "--porcelain=v1", "-z")).toBe("");
    await expect(service.list(record.id)).resolves.toEqual([entry]);

    await service.apply(record.id, entry.id, false);
    expect(git(repository, "show", ":tracked.txt")).toBe("staged\n");
    expect(await readFile(join(repository, "tracked.txt"), "utf8")).toBe("worktree\n");
    expect(await readFile(join(repository, untrackedPath))).toEqual(untrackedBytes);
    await expect(service.apply(record.id, entry.id, false)).rejects.toMatchObject({
      code: "invalidInput",
    });

    git(repository, "restore", "--source=HEAD", "--staged", "--worktree", "--", "tracked.txt");
    await rm(join(repository, untrackedPath));
    await service.apply(record.id, entry.id, true);
    await expect(service.list(record.id)).resolves.toEqual([]);
  });

  it("uses only fixed Git argv, canonical cwd, bounded output, and the caller's abort signal", async () => {
    const repository = await createRepository();
    const record = repositoryRecord(repository);
    const storageRoot = join(await temporaryDirectory(), "profile");
    await mkdir(storageRoot);
    const indexPatch = Buffer.from([0, 0xff, 0x0a]);
    const worktreePatch = Buffer.from([0xfe, 0x0a]);
    const runner = new RecordingRunner([
      completed(indexPatch),
      completed(worktreePatch),
      completed(),
      completed(),
    ]);
    const controller = new AbortController();
    const service = new ShelfService(registry(record), storageRoot, runner);

    const entry = await service.create(record.id, " ", ["tracked.txt"], controller.signal);

    expect(entry.message).toBe("Shelved changes");
    expect(runner.specs.map(({ args }) => args)).toEqual([
      ["diff", "--binary", "--full-index", "--no-color", "--cached", "--", "tracked.txt"],
      ["diff", "--binary", "--full-index", "--no-color", "--", "tracked.txt"],
      ["ls-files", "--others", "--exclude-standard", "-z", "--", "tracked.txt"],
      ["restore", "--source=HEAD", "--staged", "--worktree", "--", "tracked.txt"],
    ]);
    expect(runner.specs.every((spec) => spec.cwd === repository)).toBe(true);
    expect(
      runner.specs.slice(0, 2).every((spec) => spec.stdoutLimitBytes === MAX_SHELF_PATCH_BYTES + 1),
    ).toBe(true);
    expect(runner.signals.every((signal) => signal === controller.signal)).toBe(true);
    expect(
      await readFile(join(storageRoot, "shelves", record.id, entry.id, "index.patch")),
    ).toEqual(indexPatch);
  });

  it("rejects invalid messages and pathspecs before Git or filesystem side effects", async () => {
    const repository = await createRepository();
    const record = repositoryRecord(repository);
    const storageRoot = join(await temporaryDirectory(), "profile");
    await mkdir(storageRoot);
    const runner = new RecordingRunner([]);
    const service = new ShelfService(registry(record), storageRoot, runner);
    const invalidCases: ReadonlyArray<readonly [unknown, unknown]> = [
      ["message", []],
      ["message", "tracked.txt"],
      ["message", ["../outside"]],
      ["message", ["nested/../tracked.txt"]],
      ["message", ["nested//file.txt"]],
      ["message", ["/absolute"]],
      ["message", ["bad\0path"]],
      ["bad\0message", ["tracked.txt"]],
      [42, ["tracked.txt"]],
    ];

    for (const [message, paths] of invalidCases) {
      await expect(service.create(record.id, message, paths)).rejects.toMatchObject({
        code: "invalidInput",
      });
    }
    expect(runner.specs).toEqual([]);
    await expect(access(join(storageRoot, "shelves"))).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects storage and repository symlinks without following or deleting their targets", async () => {
    const repository = await createRepository();
    const record = repositoryRecord(repository);
    const root = await temporaryDirectory();
    const storageRoot = join(root, "profile");
    const outsideStorage = join(root, "outside-storage");
    await mkdir(storageRoot);
    await mkdir(outsideStorage);
    await symlink(outsideStorage, join(storageRoot, "shelves"), "dir");
    const service = new ShelfService(registry(record), storageRoot, new PatchProcessRunner());

    await expect(service.create(record.id, "change", ["tracked.txt"])).rejects.toMatchObject({
      code: "invalidInput",
    });
    expect(await readdir(outsideStorage)).toEqual([]);

    await rm(join(storageRoot, "shelves"));
    const outsideFile = join(root, "outside.txt");
    await writeFile(outsideFile, "outside\n", "utf8");
    await symlink(outsideFile, join(repository, "link.txt"));
    await expect(service.create(record.id, "link", ["link.txt"])).rejects.toMatchObject({
      code: "invalidInput",
    });
    expect(await readFile(outsideFile, "utf8")).toBe("outside\n");
    expect(await readFile(join(repository, "link.txt"), "utf8")).toBe("outside\n");
    await expect(service.list(record.id)).resolves.toEqual([]);

    const shelfLinkId = randomUUID();
    const repositoryShelves = join(storageRoot, "shelves", record.id);
    await symlink(outsideStorage, join(repositoryShelves, shelfLinkId), "dir");
    await expect(service.delete(record.id, shelfLinkId)).rejects.toMatchObject({
      code: "invalidInput",
    });
    expect(await readdir(outsideStorage)).toEqual([]);
  });

  it("preflights untracked restore destinations and blocks parent-symlink escapes", async () => {
    const repository = await createRepository();
    const record = repositoryRecord(repository);
    const root = await temporaryDirectory();
    const storageRoot = join(root, "profile");
    const outside = join(root, "outside");
    await mkdir(storageRoot);
    await mkdir(outside);
    await mkdir(join(repository, "nested"));
    await writeFile(join(repository, "nested", "payload.bin"), Buffer.from([0xff, 0, 1]));
    const service = new ShelfService(registry(record), storageRoot, new PatchProcessRunner());
    const entry = await service.create(record.id, "untracked", ["nested/payload.bin"]);
    await rm(join(repository, "nested"), { recursive: true });
    await symlink(outside, join(repository, "nested"), "dir");

    await expect(service.apply(record.id, entry.id, false)).rejects.toMatchObject({
      code: "invalidInput",
    });
    await expect(access(join(outside, "payload.bin"))).rejects.toMatchObject({ code: "ENOENT" });
    await expect(service.list(record.id)).resolves.toEqual([entry]);
  });

  it("detects tampering before apply or delete and never removes an unverified shelf", async () => {
    const repository = await createRepository();
    const record = repositoryRecord(repository);
    const storageRoot = join(await temporaryDirectory(), "profile");
    await mkdir(storageRoot);
    await writeFile(join(repository, "tracked.txt"), "changed\n", "utf8");
    const service = new ShelfService(registry(record), storageRoot, new PatchProcessRunner());
    const entry = await service.create(record.id, "tamper target", ["tracked.txt"]);
    const directory = join(storageRoot, "shelves", record.id, entry.id);
    await writeFile(join(directory, "worktree.patch"), "tampered\n", "utf8");

    await expect(service.apply(record.id, entry.id, false)).rejects.toMatchObject({
      code: "invalidInput",
    });
    await expect(service.delete(record.id, entry.id)).rejects.toMatchObject({
      code: "invalidInput",
    });
    await expect(access(directory)).resolves.toBeUndefined();
  });

  it("cleans temporary shelves and propagates cancellation, output limits, and redacted diagnostics", async () => {
    const repository = await createRepository();
    const record = repositoryRecord(repository);
    const root = await temporaryDirectory();
    const storageRoot = join(root, "profile");
    await mkdir(storageRoot);
    const controller = new AbortController();
    const cancelledRunner = new RecordingRunner([
      {
        kind: "cancelled",
        reason: "requested",
        stdout: Buffer.alloc(0),
        stderr: Buffer.alloc(0),
        durationMs: 1,
      },
    ]);
    await expect(
      new ShelfService(registry(record), storageRoot, cancelledRunner).create(
        record.id,
        "cancel",
        ["tracked.txt"],
        controller.signal,
      ),
    ).rejects.toMatchObject({ code: "commandFailed" });
    expect(cancelledRunner.signals).toEqual([controller.signal]);

    const tooLargeRunner = new RecordingRunner([
      completed(Buffer.alloc(MAX_SHELF_PATCH_BYTES + 1, 0x78)),
    ]);
    await expect(
      new ShelfService(registry(record), storageRoot, tooLargeRunner).create(record.id, "large", [
        "tracked.txt",
      ]),
    ).rejects.toMatchObject({ code: "outputLimit" });

    const secret = `https://alice:password@example.invalid token=secret-${randomUUID()}`;
    const failedRunner = new RecordingRunner([
      failed("commandFailed", secret, Buffer.from(secret, "utf8")),
    ]);
    const error = await new ShelfService(registry(record), storageRoot, failedRunner)
      .create(record.id, "failure", ["tracked.txt"])
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(GitUtilityError);
    expect(String((error as Error).message)).toContain("[redacted]");
    expect(String((error as Error).message)).not.toContain("password");
    expect(String((error as Error).message)).not.toContain("secret-");

    const repositoryShelves = join(storageRoot, "shelves", record.id);
    const children = await readdir(repositoryShelves).catch(() => [] as string[]);
    expect(children).toEqual([]);
  });
});
