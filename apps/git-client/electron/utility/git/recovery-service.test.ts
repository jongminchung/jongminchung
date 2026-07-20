import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  link,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { v5 as uuidV5 } from "uuid";
import { afterEach, describe, expect, it } from "vitest";
import type {
  GitOutputStream,
  RepositoryId,
  RepositoryRecord,
} from "../../../src/shared/contracts/git-utility";
import type { GitOperation } from "../../../src/shared/contracts/model";
import { GitUtilityError } from "./git-error";
import {
  GitProcessRunner,
  type GitProcessOutcome,
  type GitProcessRunnerLike,
  type GitProcessSpec,
} from "./git-process";
import {
  MAX_RECOVERY_ENTRIES,
  MAX_RECOVERY_MANIFEST_BYTES,
  RecoveryService,
  type RecoveryRepositoryRegistryLike,
} from "./recovery-service";
import { MAX_RECOVERY_SNAPSHOT_FILE_BYTES } from "./recovery-snapshot";

const temporaryDirectories: string[] = [];
const GIT_ENVIRONMENT = Object.freeze({
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_OPTIONAL_LOCKS: "0",
  GIT_PAGER: "cat",
  LC_ALL: "C",
});

interface Fixture {
  readonly parent: string;
  readonly repository: string;
  readonly storage: string;
  readonly record: RepositoryRecord;
  readonly registry: RecoveryRepositoryRegistryLike;
}

function git(cwd: string, ...args: readonly string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    env: GIT_ENVIRONMENT,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout.trim();
}

function optionalRef(cwd: string, name: string): string | null {
  const result = spawnSync("git", ["rev-parse", "--verify", "--end-of-options", name], {
    cwd,
    env: GIT_ENVIRONMENT,
    encoding: "utf8",
    shell: false,
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

async function createFixture(): Promise<Fixture> {
  const createdParent = await mkdtemp(join(tmpdir(), "git-client-recovery-"));
  const parent = await realpath(createdParent);
  temporaryDirectories.push(parent);
  const repository = join(parent, "repository");
  const storage = join(parent, "storage");
  await Promise.all([mkdir(repository), mkdir(storage)]);
  git(repository, "init", "--initial-branch=main");
  git(repository, "config", "user.name", "Recovery Test");
  git(repository, "config", "user.email", "recovery@example.invalid");
  await writeFile(join(repository, "문서.txt"), "초기 내용 🌱\n", "utf8");
  await writeFile(join(repository, "binary.bin"), Buffer.from([0, 255, 1, 2, 128, 10]));
  git(repository, "add", "--", "문서.txt", "binary.bin");
  git(repository, "commit", "-m", "initial");
  const id = uuidV5(repository, uuidV5.URL) as RepositoryId;
  const record: RepositoryRecord = {
    id,
    name: "repository",
    path: repository,
    gitDirectory: join(repository, ".git"),
    commonDirectory: join(repository, ".git"),
    isBare: false,
    gitVersion: {
      major: 2,
      minor: 50,
      patch: 1,
      display: "git version 2.50.1",
    },
  };
  return {
    parent,
    repository,
    storage,
    record,
    registry: {
      get(repositoryId) {
        if (repositoryId !== id) {
          throw new GitUtilityError("repositoryNotOpen", "Repository is not open");
        }
        return record;
      },
    },
  };
}

function commitOperation(): GitOperation {
  return {
    kind: "commit",
    message: "next",
    amend: false,
    signOff: false,
    gpgSign: false,
  };
}

function manifestPath(fixture: Fixture): string {
  return join(fixture.storage, "recovery", `${fixture.record.id}.json`);
}

function output(stream: GitOutputStream, data: string): GitProcessOutcome {
  return {
    kind: "completed",
    exitCode: 0,
    durationMs: 1,
    output: data.length === 0 ? [] : [{ stream, data }],
  };
}

function hash(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

class DelegatingRunner implements GitProcessRunnerLike {
  readonly #delegate = new GitProcessRunner();
  readonly #beforeRun: (spec: GitProcessSpec, signal: AbortSignal | undefined) => void;

  constructor(beforeRun: (spec: GitProcessSpec, signal: AbortSignal | undefined) => void) {
    this.#beforeRun = beforeRun;
  }

  run(spec: GitProcessSpec, signal?: AbortSignal): Promise<GitProcessOutcome> {
    this.#beforeRun(spec, signal);
    return this.#delegate.run(spec, signal);
  }
}

class DeterministicRunner implements GitProcessRunnerLike {
  readonly oid: string;

  constructor(oid: string) {
    this.oid = oid;
  }

  run(spec: GitProcessSpec, signal?: AbortSignal): Promise<GitProcessOutcome> {
    if (signal?.aborted === true) {
      return Promise.resolve({
        kind: "cancelled",
        reason: "requested",
        durationMs: 1,
        output: [],
      });
    }
    const command = spec.args[0];
    if (command === "symbolic-ref") return Promise.resolve(output("stdout", "main\n"));
    if (command === "rev-parse") return Promise.resolve(output("stdout", `${this.oid}\n`));
    return Promise.resolve(output("stdout", ""));
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("RecoveryService", () => {
  it("records only contract-supported ref operations and persists an integrity-checked manifest", async () => {
    const fixture = await createFixture();
    const service = RecoveryService.of(fixture.registry, fixture.storage);
    const head = git(fixture.repository, "rev-parse", "HEAD");

    const entry = await service.recordBeforeOperation(fixture.record.id, commitOperation());

    expect(entry).toMatchObject({
      repositoryId: fixture.record.id,
      operation: "commit",
      branch: "main",
      headOid: head,
      recoverable: true,
      refs: [{ name: "refs/heads/main", oid: head }],
    });
    expect(entry).not.toHaveProperty("snapshot");
    await expect(
      service.recordBeforeOperation(fixture.record.id, {
        kind: "fetch",
        remote: null,
        prune: false,
      }),
    ).resolves.toBeNull();
    await expect(
      service.recordBeforeOperation(fixture.record.id, {
        kind: "renameBranch",
        oldName: "--unsafe",
        newName: "main",
      }),
    ).rejects.toMatchObject({ code: "invalidInput" });

    const listed = await service.list(fixture.record.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]).toEqual(entry);

    const bytes = await readFile(manifestPath(fixture));
    const manifest = JSON.parse(bytes.toString("utf8")) as {
      readonly version: number;
      readonly entries: readonly unknown[];
      readonly sha256: string;
    };
    expect(manifest.version).toBe(2);
    expect(manifest.entries).toHaveLength(1);
    expect(manifest.sha256).toBe(
      hash(
        Buffer.from(
          JSON.stringify({
            version: manifest.version,
            entries: manifest.entries,
          }),
        ),
      ),
    );
    const metadata = await lstat(manifestPath(fixture));
    expect(metadata.isFile()).toBe(true);
    expect(metadata.nlink).toBe(1);
    expect(metadata.mode & 0o777).toBe(0o600);
  });

  it("restores refs, index, tracked worktree, and untracked bytes and records an exact inverse", async () => {
    const fixture = await createFixture();
    const service = RecoveryService.of(fixture.registry, fixture.storage);
    const first = git(fixture.repository, "rev-parse", "HEAD");
    const initialUnicodeBytes = await readFile(join(fixture.repository, "문서.txt"));
    const initialBinaryBytes = await readFile(join(fixture.repository, "binary.bin"));
    const entry = await service.recordBeforeOperation(fixture.record.id, commitOperation());
    if (entry === null) throw new Error("Expected recovery entry");

    await writeFile(join(fixture.repository, "second.txt"), "second\n", "utf8");
    git(fixture.repository, "add", "--", "second.txt");
    git(fixture.repository, "commit", "-m", "second");
    const second = git(fixture.repository, "rev-parse", "HEAD");
    const unicodeBytes = Buffer.from("작업 중인 내용 🧪\n", "utf8");
    const binaryBytes = Buffer.from([0, 1, 2, 255, 128, 42, 0, 10]);
    await Promise.all([
      writeFile(join(fixture.repository, "문서.txt"), unicodeBytes),
      writeFile(join(fixture.repository, "binary.bin"), binaryBytes),
    ]);

    await expect(service.restore(fixture.record.id, entry.id)).resolves.toEqual({
      entryId: entry.id,
      restoredRefs: ["refs/heads/main"],
    });
    expect(git(fixture.repository, "rev-parse", "refs/heads/main")).toBe(first);
    await expect(readFile(join(fixture.repository, "문서.txt"))).resolves.toEqual(
      initialUnicodeBytes,
    );
    await expect(readFile(join(fixture.repository, "binary.bin"))).resolves.toEqual(
      initialBinaryBytes,
    );
    await expect(access(join(fixture.repository, "second.txt"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(git(fixture.repository, "status", "--porcelain=v2", "-z")).toBe("");

    const entries = await service.list(fixture.record.id);
    const inverse = entries.find((candidate) => candidate.operation === "restore commit");
    expect(inverse?.refs).toEqual([{ name: "refs/heads/main", oid: second }]);
    if (inverse === undefined) throw new Error("Expected inverse recovery entry");
    await expect(service.restore(fixture.record.id, inverse.id)).resolves.toMatchObject({
      restoredRefs: ["refs/heads/main"],
    });
    expect(git(fixture.repository, "rev-parse", "refs/heads/main")).toBe(second);
    await expect(readFile(join(fixture.repository, "문서.txt"))).resolves.toEqual(unicodeBytes);
    await expect(readFile(join(fixture.repository, "binary.bin"))).resolves.toEqual(binaryBytes);
    await expect(readFile(join(fixture.repository, "second.txt"), "utf8")).resolves.toBe(
      "second\n",
    );
  });

  it("round-trips partially staged, staged, deleted, untracked, Unicode, and binary state", async () => {
    const fixture = await createFixture();
    await writeFile(join(fixture.repository, "deleted.txt"), "delete me\n", "utf8");
    git(fixture.repository, "add", "--", "deleted.txt");
    git(fixture.repository, "commit", "-m", "snapshot baseline");
    const service = RecoveryService.of(fixture.registry, fixture.storage);

    await writeFile(join(fixture.repository, "문서.txt"), "staged 내용\n", "utf8");
    git(fixture.repository, "add", "--", "문서.txt");
    const worktreeUnicode = Buffer.from("worktree 내용 🧪\n", "utf8");
    await writeFile(join(fixture.repository, "문서.txt"), worktreeUnicode);
    await writeFile(join(fixture.repository, "binary.bin"), Buffer.from([0, 1, 2, 3, 255]));
    git(fixture.repository, "add", "--", "binary.bin");
    const worktreeBinary = Buffer.from([255, 0, 128, 7, 6, 5, 0]);
    await writeFile(join(fixture.repository, "binary.bin"), worktreeBinary);
    await rm(join(fixture.repository, "deleted.txt"));
    const untrackedBinary = Buffer.from([0, 255, 19, 0, 200, 10]);
    await writeFile(join(fixture.repository, "새 파일.bin"), untrackedBinary);

    const beforeStatus = git(fixture.repository, "status", "--porcelain=v2", "--branch", "-z");
    const beforeIndexDiff = git(
      fixture.repository,
      "diff",
      "--cached",
      "--binary",
      "--no-ext-diff",
    );
    const beforeWorktreeDiff = git(fixture.repository, "diff", "--binary", "--no-ext-diff");
    const beforeIndex = await readFile(join(fixture.record.gitDirectory, "index"));
    const entry = await service.recordBeforeOperation(fixture.record.id, commitOperation());
    if (entry === null) throw new Error("Expected recovery entry");

    git(fixture.repository, "add", "-A", "--");
    git(fixture.repository, "commit", "-m", "mutated state");
    await writeFile(join(fixture.repository, "문서.txt"), "post-operation\n", "utf8");
    await writeFile(join(fixture.repository, "binary.bin"), Buffer.from([9, 8, 7, 6]));
    await writeFile(join(fixture.repository, "extra.txt"), "extra\n", "utf8");
    git(fixture.repository, "add", "--", "문서.txt");

    await expect(service.restore(fixture.record.id, entry.id)).resolves.toMatchObject({
      restoredRefs: ["refs/heads/main"],
    });
    expect(git(fixture.repository, "status", "--porcelain=v2", "--branch", "-z")).toBe(
      beforeStatus,
    );
    expect(git(fixture.repository, "diff", "--cached", "--binary", "--no-ext-diff")).toBe(
      beforeIndexDiff,
    );
    expect(git(fixture.repository, "diff", "--binary", "--no-ext-diff")).toBe(beforeWorktreeDiff);
    await expect(readFile(join(fixture.record.gitDirectory, "index"))).resolves.toEqual(
      beforeIndex,
    );
    await expect(readFile(join(fixture.repository, "문서.txt"))).resolves.toEqual(worktreeUnicode);
    await expect(readFile(join(fixture.repository, "binary.bin"))).resolves.toEqual(worktreeBinary);
    await expect(readFile(join(fixture.repository, "새 파일.bin"))).resolves.toEqual(
      untrackedBinary,
    );
    await expect(access(join(fixture.repository, "deleted.txt"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(access(join(fixture.repository, "extra.txt"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("atomically restores a rename and applies oid-null as a compare-and-swap ref deletion", async () => {
    const fixture = await createFixture();
    const service = RecoveryService.of(fixture.registry, fixture.storage);
    const oldName = "feature-old";
    const newName = "기능-🌱;touch-injected";
    const injected = join(fixture.repository, "touch-injected");
    git(fixture.repository, "branch", oldName, "HEAD");
    const operation: GitOperation = {
      kind: "renameBranch",
      oldName,
      newName,
    };
    const entry = await service.recordBeforeOperation(fixture.record.id, operation);
    if (entry === null) throw new Error("Expected recovery entry");
    git(fixture.repository, "branch", "-m", oldName, newName);

    await expect(service.restore(fixture.record.id, entry.id)).resolves.toEqual({
      entryId: entry.id,
      restoredRefs: [`refs/heads/${oldName}`, `refs/heads/${newName}`],
    });
    expect(optionalRef(fixture.repository, `refs/heads/${oldName}`)).toBe(entry.refs[0]?.oid);
    expect(optionalRef(fixture.repository, `refs/heads/${newName}`)).toBeNull();
    await expect(access(injected)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("aborts the whole multi-ref transaction on a CAS race without a partial restore", async () => {
    const fixture = await createFixture();
    const oldName = "old";
    const newName = "new";
    const first = git(fixture.repository, "rev-parse", "HEAD");
    git(fixture.repository, "branch", oldName, first);
    await writeFile(join(fixture.repository, "race.txt"), "race\n", "utf8");
    git(fixture.repository, "add", "--", "race.txt");
    git(fixture.repository, "commit", "-m", "race target");
    const racedOid = git(fixture.repository, "rev-parse", "HEAD");
    let raced = false;
    const runner = new DelegatingRunner((spec) => {
      if (spec.args[0] !== "update-ref" || raced) return;
      raced = true;
      git(fixture.repository, "update-ref", `refs/heads/${newName}`, racedOid);
    });
    const service = RecoveryService.of(fixture.registry, fixture.storage, runner);
    const entry = await service.recordBeforeOperation(fixture.record.id, {
      kind: "renameBranch",
      oldName,
      newName,
    });
    if (entry === null) throw new Error("Expected recovery entry");
    git(fixture.repository, "branch", "-m", oldName, newName);
    await writeFile(join(fixture.repository, "문서.txt"), "staged after rename\n", "utf8");
    git(fixture.repository, "add", "--", "문서.txt");
    const dirtyBytes = Buffer.from("worktree after rename 🧪\n", "utf8");
    await writeFile(join(fixture.repository, "문서.txt"), dirtyBytes);
    const beforeStatus = git(fixture.repository, "status", "--porcelain=v2", "-z");
    const beforeIndex = await readFile(join(fixture.record.gitDirectory, "index"));

    await expect(service.restore(fixture.record.id, entry.id)).rejects.toMatchObject({
      code: "commandFailed",
    });
    expect(optionalRef(fixture.repository, `refs/heads/${oldName}`)).toBeNull();
    expect(optionalRef(fixture.repository, `refs/heads/${newName}`)).toBe(racedOid);
    expect(git(fixture.repository, "status", "--porcelain=v2", "-z")).toBe(beforeStatus);
    await expect(readFile(join(fixture.record.gitDirectory, "index"))).resolves.toEqual(
      beforeIndex,
    );
    await expect(readFile(join(fixture.repository, "문서.txt"))).resolves.toEqual(dirtyBytes);
    const entries = await service.list(fixture.record.id);
    expect(entries.some((candidate) => candidate.operation === "restore rename branch")).toBe(true);
  });

  it("marks an entry unrecoverable when its recorded object has expired and refuses to mutate refs", async () => {
    const fixture = await createFixture();
    const service = RecoveryService.of(fixture.registry, fixture.storage);
    const blob = git(fixture.repository, "hash-object", "-w", "문서.txt");
    git(fixture.repository, "update-ref", "refs/tags/ephemeral", blob);
    const entry = await service.recordBeforeOperation(fixture.record.id, {
      kind: "deleteTag",
      name: "ephemeral",
    });
    if (entry === null) throw new Error("Expected recovery entry");
    git(fixture.repository, "update-ref", "-d", "refs/tags/ephemeral", blob);
    await rm(join(fixture.record.gitDirectory, "objects", blob.slice(0, 2), blob.slice(2)));

    const listed = await service.list(fixture.record.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.recoverable).toBe(false);
    await expect(service.restore(fixture.record.id, entry.id)).rejects.toMatchObject({
      code: "invalidInput",
    });
    expect(optionalRef(fixture.repository, "refs/tags/ephemeral")).toBeNull();
    await expect(service.list(fixture.record.id)).resolves.toHaveLength(1);
  });

  it("rejects tampered, oversized, symbolic-link, and hard-linked manifests without following them", async () => {
    const fixture = await createFixture();
    const service = RecoveryService.of(fixture.registry, fixture.storage);
    await service.recordBeforeOperation(fixture.record.id, commitOperation());
    const path = manifestPath(fixture);
    const original = await readFile(path);

    const hardLink = join(fixture.parent, "manifest-hard-link.json");
    await link(path, hardLink);
    await expect(service.list(fixture.record.id)).rejects.toMatchObject({
      code: "invalidInput",
    });
    await rm(hardLink);
    await expect(service.list(fixture.record.id)).resolves.toHaveLength(1);

    const tampered = JSON.parse(original.toString("utf8")) as {
      entries: Array<{ operation: string }>;
    };
    const first = tampered.entries[0];
    if (first === undefined) throw new Error("Expected manifest entry");
    first.operation = "tampered";
    await writeFile(path, JSON.stringify(tampered), "utf8");
    await expect(service.list(fixture.record.id)).rejects.toMatchObject({
      code: "invalidInput",
    });

    await writeFile(path, Buffer.alloc(MAX_RECOVERY_MANIFEST_BYTES + 1, 0x78));
    await expect(service.list(fixture.record.id)).rejects.toMatchObject({
      code: "outputLimit",
    });

    const outside = join(fixture.parent, "outside.json");
    const displaced = join(fixture.parent, "displaced.json");
    const outsideBytes = Buffer.from("outside must remain unchanged\n", "utf8");
    await writeFile(outside, outsideBytes);
    await rename(path, displaced);
    await symlink(outside, path);
    await expect(service.list(fixture.record.id)).rejects.toMatchObject({
      code: "invalidInput",
    });
    await expect(readFile(outside)).resolves.toEqual(outsideBytes);
  });

  it("rejects storage and repository directory symlinks without writing outside them", async () => {
    const fixture = await createFixture();
    const outside = join(fixture.parent, "outside-storage");
    await mkdir(outside);
    await symlink(outside, join(fixture.storage, "recovery"), "dir");
    const service = RecoveryService.of(fixture.registry, fixture.storage);

    await expect(
      service.recordBeforeOperation(fixture.record.id, commitOperation()),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(access(join(outside, `${fixture.record.id}.json`))).rejects.toMatchObject({
      code: "ENOENT",
    });

    const linkedRepository = join(fixture.parent, "linked-repository");
    await symlink(fixture.repository, linkedRepository, "dir");
    const linkedRecord: RepositoryRecord = {
      ...fixture.record,
      path: linkedRepository,
    };
    const linkedRegistry: RecoveryRepositoryRegistryLike = {
      get() {
        return linkedRecord;
      },
    };
    await expect(
      RecoveryService.of(linkedRegistry, fixture.storage).list(fixture.record.id),
    ).rejects.toMatchObject({ code: "invalidInput" });
  });

  it("fails closed before storage or repository mutation when snapshot limits are exceeded", async () => {
    const fixture = await createFixture();
    const service = RecoveryService.of(fixture.registry, fixture.storage);
    const beforeHead = git(fixture.repository, "rev-parse", "HEAD");
    const beforeIndex = await readFile(join(fixture.record.gitDirectory, "index"));
    const oversized = join(fixture.repository, "oversized.bin");
    await writeFile(oversized, Buffer.alloc(MAX_RECOVERY_SNAPSHOT_FILE_BYTES + 1, 0x5a));
    const beforeStatus = git(fixture.repository, "status", "--porcelain=v2", "-z");

    await expect(
      service.recordBeforeOperation(fixture.record.id, commitOperation()),
    ).rejects.toMatchObject({ code: "outputLimit" });

    expect(git(fixture.repository, "rev-parse", "HEAD")).toBe(beforeHead);
    expect(git(fixture.repository, "status", "--porcelain=v2", "-z")).toBe(beforeStatus);
    await expect(readFile(join(fixture.record.gitDirectory, "index"))).resolves.toEqual(
      beforeIndex,
    );
    await expect(access(join(fixture.storage, "recovery"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("rejects a worktree parent symlink without following or mutating its target", async () => {
    const fixture = await createFixture();
    const nested = join(fixture.repository, "nested");
    const outside = join(fixture.parent, "outside-worktree");
    await Promise.all([mkdir(nested), mkdir(outside)]);
    await writeFile(join(nested, "tracked.txt"), "inside\n", "utf8");
    git(fixture.repository, "add", "--", "nested/tracked.txt");
    git(fixture.repository, "commit", "-m", "nested baseline");
    await rm(nested, { recursive: true });
    const outsideFile = join(outside, "tracked.txt");
    await writeFile(outsideFile, "outside must remain\n", "utf8");
    await symlink(outside, nested, "dir");
    const service = RecoveryService.of(fixture.registry, fixture.storage);

    await expect(
      service.recordBeforeOperation(fixture.record.id, commitOperation()),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(readFile(outsideFile, "utf8")).resolves.toBe("outside must remain\n");
    await expect(access(join(fixture.storage, "recovery"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("detects a worktree race during capture and writes no recovery entry", async () => {
    const fixture = await createFixture();
    let pathListCalls = 0;
    const runner = new DelegatingRunner((spec) => {
      if (spec.args[0] !== "ls-files") return;
      pathListCalls += 1;
      if (pathListCalls !== 3) return;
      const raced = spawnSync(
        process.execPath,
        [
          "-e",
          "require('node:fs').appendFileSync(process.argv[1], 'raced\\n')",
          join(fixture.repository, "문서.txt"),
        ],
        { shell: false },
      );
      if (raced.status !== 0) throw new Error("Unable to inject worktree race");
    });
    const service = RecoveryService.of(fixture.registry, fixture.storage, runner);

    await expect(
      service.recordBeforeOperation(fixture.record.id, commitOperation()),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(access(join(fixture.storage, "recovery"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("reads version 1 ref-only entries and preserves their legacy worktree behavior", async () => {
    const fixture = await createFixture();
    const service = RecoveryService.of(fixture.registry, fixture.storage);
    const entry = await service.recordBeforeOperation(fixture.record.id, commitOperation());
    if (entry === null) throw new Error("Expected recovery entry");
    const payload = { version: 1 as const, entries: [entry] };
    await writeFile(
      manifestPath(fixture),
      `${JSON.stringify({ ...payload, sha256: hash(Buffer.from(JSON.stringify(payload))) }, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600 },
    );
    await writeFile(join(fixture.repository, "later.txt"), "later\n", "utf8");
    git(fixture.repository, "add", "--", "later.txt");
    git(fixture.repository, "commit", "-m", "later");
    await writeFile(join(fixture.repository, "문서.txt"), "legacy worktree remains\n", "utf8");

    await expect(service.list(fixture.record.id)).resolves.toEqual([entry]);
    await expect(service.restore(fixture.record.id, entry.id)).resolves.toMatchObject({
      restoredRefs: ["refs/heads/main"],
    });
    await expect(readFile(join(fixture.repository, "문서.txt"), "utf8")).resolves.toBe(
      "legacy worktree remains\n",
    );
  });

  it("refuses a busy index before restore and leaves refs, index, and files unchanged", async () => {
    const fixture = await createFixture();
    const service = RecoveryService.of(fixture.registry, fixture.storage);
    const entry = await service.recordBeforeOperation(fixture.record.id, commitOperation());
    if (entry === null) throw new Error("Expected recovery entry");
    await writeFile(join(fixture.repository, "later.txt"), "later\n", "utf8");
    git(fixture.repository, "add", "--", "later.txt");
    git(fixture.repository, "commit", "-m", "later");
    await writeFile(join(fixture.repository, "문서.txt"), "busy index state\n", "utf8");
    const beforeHead = git(fixture.repository, "rev-parse", "HEAD");
    const beforeStatus = git(fixture.repository, "status", "--porcelain=v2", "-z");
    const beforeIndex = await readFile(join(fixture.record.gitDirectory, "index"));
    const beforeFile = await readFile(join(fixture.repository, "문서.txt"));
    const lockPath = join(fixture.record.gitDirectory, "index.lock");
    await writeFile(lockPath, "busy", { encoding: "utf8", mode: 0o600 });

    await expect(service.restore(fixture.record.id, entry.id)).rejects.toMatchObject({
      code: "invalidInput",
    });
    expect(git(fixture.repository, "rev-parse", "HEAD")).toBe(beforeHead);
    expect(git(fixture.repository, "status", "--porcelain=v2", "-z")).toBe(beforeStatus);
    await expect(readFile(join(fixture.record.gitDirectory, "index"))).resolves.toEqual(
      beforeIndex,
    );
    await expect(readFile(join(fixture.repository, "문서.txt"))).resolves.toEqual(beforeFile);
    await expect(readFile(lockPath, "utf8")).resolves.toBe("busy");
  });

  it("persists the inverse before a cancelled restore and leaves the ref untouched", async () => {
    const fixture = await createFixture();
    const controller = new AbortController();
    const runner = new DelegatingRunner((spec) => {
      if (spec.args[0] === "update-ref") controller.abort("requested");
    });
    const service = RecoveryService.of(fixture.registry, fixture.storage, runner);
    const entry = await service.recordBeforeOperation(fixture.record.id, commitOperation());
    if (entry === null) throw new Error("Expected recovery entry");
    await writeFile(join(fixture.repository, "later.txt"), "later\n", "utf8");
    git(fixture.repository, "add", "--", "later.txt");
    git(fixture.repository, "commit", "-m", "later");
    const later = git(fixture.repository, "rev-parse", "HEAD");

    await expect(
      service.restore(fixture.record.id, entry.id, controller.signal),
    ).rejects.toMatchObject({
      code: "commandFailed",
      message: expect.stringContaining("cancelled"),
    });
    expect(git(fixture.repository, "rev-parse", "refs/heads/main")).toBe(later);
    const entries = await service.list(fixture.record.id);
    expect(entries).toHaveLength(2);
    expect(entries.some((candidate) => candidate.operation === "restore commit")).toBe(true);

    const preCancelled = new AbortController();
    preCancelled.abort("requested");
    await expect(service.list(fixture.record.id, preCancelled.signal)).rejects.toMatchObject({
      code: "commandFailed",
    });
  });

  it("retains only the newest 200 entries and rejects a pre-cancelled record before storage changes", async () => {
    const fixture = await createFixture();
    const oid = git(fixture.repository, "rev-parse", "HEAD");
    const service = RecoveryService.of(
      fixture.registry,
      fixture.storage,
      new DeterministicRunner(oid),
    );
    const cancelled = new AbortController();
    cancelled.abort("requested");
    await expect(
      service.recordBeforeOperation(fixture.record.id, commitOperation(), cancelled.signal),
    ).rejects.toMatchObject({ code: "commandFailed" });
    await expect(access(join(fixture.storage, "recovery"))).rejects.toMatchObject({
      code: "ENOENT",
    });

    for (let index = 0; index < MAX_RECOVERY_ENTRIES + 1; index += 1) {
      await service.recordBeforeOperation(fixture.record.id, commitOperation());
    }
    const entries = await service.list(fixture.record.id);
    expect(entries).toHaveLength(MAX_RECOVERY_ENTRIES);
    expect(new Set(entries.map((entry) => entry.id))).toHaveLength(MAX_RECOVERY_ENTRIES);
    expect((await lstat(manifestPath(fixture))).size).toBeLessThanOrEqual(
      MAX_RECOVERY_MANIFEST_BYTES,
    );
  }, 30_000);
});
