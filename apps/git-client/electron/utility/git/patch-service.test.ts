import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
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
  MAX_CLIPBOARD_PATCH_BYTES,
  MAX_EXPORTED_PATCH_BYTES,
  MAX_IMPORTED_PATCH_BYTES,
  PATCH_COMMAND_TIMEOUT_MS,
  PatchProcessRunner,
  PatchService,
  type PatchProcessOutcome,
  type PatchProcessRunnerLike,
  type PatchProcessSpec,
} from "./patch-service";

const temporaryDirectories: string[] = [];
const GIT_ENVIRONMENT = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_PAGER: "cat",
  GIT_OPTIONAL_LOCKS: "0",
  LC_ALL: "C",
};

function git(cwd: string, ...args: readonly string[]): string {
  const result = spawnSync("git", args, {
    cwd,
    env: GIT_ENVIRONMENT,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  return result.stdout;
}

async function temporaryDirectory(prefix = "git-client-patch-"): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

async function createRepository(name = "source repository"): Promise<string> {
  const parent = await temporaryDirectory();
  const repository = join(parent, name);
  await mkdir(repository);
  git(repository, "init", "--initial-branch=main");
  git(repository, "config", "user.name", "Patch Test");
  git(repository, "config", "user.email", "patch@example.invalid");
  await writeFile(join(repository, "base.txt"), "base\n", "utf8");
  git(repository, "add", "--", "base.txt");
  git(repository, "commit", "-m", "base");
  return repository;
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

function completed(stdout: Buffer, stderr = Buffer.alloc(0)): PatchProcessOutcome {
  return { kind: "completed", exitCode: 0, stdout, stderr, durationMs: 1 };
}

class RecordingPatchRunner implements PatchProcessRunnerLike {
  readonly specs: PatchProcessSpec[] = [];
  readonly signals: Array<AbortSignal | undefined> = [];
  readonly #outcomes: PatchProcessOutcome[];
  readonly #onRun: ((spec: PatchProcessSpec) => void | Promise<void>) | undefined;

  constructor(
    outcomes: readonly PatchProcessOutcome[],
    onRun?: (spec: PatchProcessSpec) => void | Promise<void>,
  ) {
    this.#outcomes = [...outcomes];
    this.#onRun = onRun;
  }

  async run(spec: PatchProcessSpec, signal?: AbortSignal): Promise<PatchProcessOutcome> {
    this.specs.push(spec);
    this.signals.push(signal);
    await this.#onRun?.(spec);
    const outcome = this.#outcomes.shift();
    if (outcome === undefined) throw new Error("Missing fake patch-process outcome");
    return outcome;
  }
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

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("PatchService contracts", () => {
  it("validates 1..500 revisions and uses canonical repository cwd with fixed argv", async () => {
    const path = await createRepository();
    const record = repositoryRecord(path);
    const runner = new RecordingPatchRunner([
      completed(Buffer.from("first patch\n")),
      completed(Buffer.from("second patch\n")),
    ]);
    const service = new PatchService(registry(record), runner);

    await expect(service.createPatchText(record.id, ["HEAD", "feature/한글"])).resolves.toBe(
      "first patch\nsecond patch\n",
    );
    expect(runner.specs).toHaveLength(2);
    expect(runner.specs[0]).toMatchObject({
      cwd: path,
      args: ["format-patch", "--stdout", "--binary", "-1", "--end-of-options", "HEAD"],
      timeoutMs: PATCH_COMMAND_TIMEOUT_MS,
      stdoutLimitBytes: MAX_CLIPBOARD_PATCH_BYTES + 1,
    });
    expect(runner.specs[1]?.args.at(-1)).toBe("feature/한글");

    const invalid: readonly unknown[] = [
      [],
      Array.from({ length: 501 }, () => "HEAD"),
      [""],
      ["--all"],
      ["HEAD\nmain"],
      [42],
      "HEAD",
    ];
    for (const revisions of invalid) {
      await expect(service.createPatchText(record.id, revisions)).rejects.toMatchObject({
        code: "invalidInput",
      });
    }
    expect(runner.specs).toHaveLength(2);
  });

  it("preserves credential-like stdout bytes and redacts only failure diagnostics", async () => {
    const path = await createRepository();
    const record = repositoryRecord(path);
    const payload = Buffer.from(
      [
        "https://alice:secret@example.invalid/repository.git",
        "token=query-secret",
        `ghp_${"a".repeat(32)}`,
        "유니코드 patch",
      ].join("\n"),
      "utf8",
    );
    const success = new RecordingPatchRunner([completed(payload)]);
    await expect(
      new PatchService(registry(record), success).createPatchText(record.id, ["HEAD"]),
    ).resolves.toBe(payload.toString("utf8"));

    const secretDiagnostic = "https://bob:password@example.invalid token=secret-value";
    const failure = new RecordingPatchRunner([
      failed("commandFailed", secretDiagnostic, Buffer.from(secretDiagnostic)),
    ]);
    const error = await new PatchService(registry(record), failure)
      .createPatchText(record.id, ["HEAD"])
      .catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(GitUtilityError);
    expect(String((error as Error).message)).toContain("[redacted]");
    expect(String((error as Error).message)).not.toContain("password");
    expect(String((error as Error).message)).not.toContain("secret-value");
  });

  it("enforces clipboard/export/import byte limits and propagates cancel/timeout/output-limit", async () => {
    const path = await createRepository();
    const record = repositoryRecord(path);
    const oversizedClipboard = new RecordingPatchRunner([
      completed(Buffer.alloc(MAX_CLIPBOARD_PATCH_BYTES + 1, 0x78)),
    ]);
    await expect(
      new PatchService(registry(record), oversizedClipboard).createPatchText(record.id, ["HEAD"]),
    ).rejects.toMatchObject({ code: "outputLimit" });

    const exportTarget = join(await temporaryDirectory(), "large.patch");
    const oversizedExport = new RecordingPatchRunner([
      completed(Buffer.alloc(MAX_EXPORTED_PATCH_BYTES + 1, 0x78)),
    ]);
    await expect(
      new PatchService(registry(record), oversizedExport).exportPatch(
        record.id,
        ["HEAD"],
        exportTarget,
      ),
    ).rejects.toMatchObject({ code: "outputLimit" });
    await expect(access(exportTarget)).rejects.toMatchObject({ code: "ENOENT" });

    const largeImport = join(await temporaryDirectory(), "large-import.patch");
    await writeFile(largeImport, Buffer.alloc(MAX_IMPORTED_PATCH_BYTES + 1, 0x78));
    const neverRun = new RecordingPatchRunner([]);
    await expect(
      new PatchService(registry(record), neverRun).importPatch(record.id, largeImport),
    ).rejects.toMatchObject({ code: "invalidInput" });
    expect(neverRun.specs).toEqual([]);

    const cancelled = new RecordingPatchRunner([
      {
        kind: "cancelled",
        reason: "requested",
        stdout: Buffer.alloc(0),
        stderr: Buffer.alloc(0),
        durationMs: 1,
      },
    ]);
    await expect(
      new PatchService(registry(record), cancelled).createPatchText(record.id, ["HEAD"]),
    ).rejects.toMatchObject({
      code: "commandFailed",
      message: expect.stringContaining("cancelled"),
    });

    const timedOut = new RecordingPatchRunner([
      {
        kind: "cancelled",
        reason: "timeout",
        stdout: Buffer.alloc(0),
        stderr: Buffer.alloc(0),
        durationMs: 1,
      },
    ]);
    await expect(
      new PatchService(registry(record), timedOut).createPatchText(record.id, ["HEAD"]),
    ).rejects.toMatchObject({
      code: "commandFailed",
      message: expect.stringContaining("timed out"),
    });

    const limited = new RecordingPatchRunner([
      failed("outputLimit", "Git patch output exceeded its limit"),
    ]);
    await expect(
      new PatchService(registry(record), limited).createPatchText(record.id, ["HEAD"]),
    ).rejects.toMatchObject({ code: "outputLimit" });

    const controller = new AbortController();
    controller.abort("requested");
    await expect(
      new PatchService(registry(record), neverRun).createPatchText(
        record.id,
        ["HEAD"],
        controller.signal,
      ),
    ).rejects.toMatchObject({ code: "commandFailed" });
  });

  it("atomically exports without following target symlinks or a replaced parent", async () => {
    const repositoryPath = await createRepository();
    const record = repositoryRecord(repositoryPath);
    const root = await temporaryDirectory();
    const outside = join(root, "outside.txt");
    await writeFile(outside, "outside\n", "utf8");
    const linkedTarget = join(root, "linked.patch");
    await symlink(outside, linkedTarget);
    const runner = new RecordingPatchRunner([completed(Buffer.from("patch\n"))]);
    await expect(
      new PatchService(registry(record), runner).exportPatch(record.id, ["HEAD"], linkedTarget),
    ).rejects.toMatchObject({ code: "invalidInput" });
    expect(await readFile(outside, "utf8")).toBe("outside\n");
    expect(runner.specs).toEqual([]);

    const existingTarget = join(root, "existing.patch");
    await writeFile(existingTarget, "previous patch\n", "utf8");
    const failedRunner = new RecordingPatchRunner([failed("commandFailed", "format-patch failed")]);
    await expect(
      new PatchService(registry(record), failedRunner).exportPatch(
        record.id,
        ["HEAD"],
        existingTarget,
      ),
    ).rejects.toMatchObject({ code: "commandFailed" });
    expect(await readFile(existingTarget, "utf8")).toBe("previous patch\n");

    const racedTarget = join(root, "raced-target.patch");
    const targetRaceRunner = new RecordingPatchRunner(
      [completed(Buffer.from("patch\n"))],
      async () => symlink(outside, racedTarget),
    );
    await expect(
      new PatchService(registry(record), targetRaceRunner).exportPatch(
        record.id,
        ["HEAD"],
        racedTarget,
      ),
    ).rejects.toMatchObject({ code: "invalidInput" });
    expect(await readFile(outside, "utf8")).toBe("outside\n");

    const outsideDirectory = join(root, "outside-directory");
    await mkdir(outsideDirectory);
    const linkedParent = join(root, "linked-parent");
    await symlink(outsideDirectory, linkedParent, "dir");
    await expect(
      new PatchService(registry(record), runner).exportPatch(
        record.id,
        ["HEAD"],
        join(linkedParent, "escaped.patch"),
      ),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(access(join(outsideDirectory, "escaped.patch"))).rejects.toMatchObject({
      code: "ENOENT",
    });

    const originalParent = join(root, "race-parent");
    const movedParent = join(root, "race-parent-original");
    await mkdir(originalParent);
    const raceTarget = join(originalParent, "result.patch");
    const raceRunner = new RecordingPatchRunner([completed(Buffer.from("patch\n"))], async () => {
      await rename(originalParent, movedParent);
      await mkdir(originalParent);
    });
    await expect(
      new PatchService(registry(record), raceRunner).exportPatch(record.id, ["HEAD"], raceTarget),
    ).rejects.toMatchObject({ code: "invalidInput" });
    await expect(access(raceTarget)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(access(join(movedParent, "result.patch"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("imports only a selected regular file and sends its raw bytes through fixed apply argv", async () => {
    const path = await createRepository();
    const record = repositoryRecord(path);
    const root = await temporaryDirectory();
    const patchPath = join(root, "selected.patch");
    const patch = Buffer.from("diff --git a/a b/a\n", "utf8");
    await writeFile(patchPath, patch);
    const runner = new RecordingPatchRunner([completed(Buffer.alloc(0))]);
    const service = new PatchService(registry(record), runner);

    await service.importPatch(record.id, patchPath);
    expect(runner.specs).toHaveLength(1);
    expect(runner.specs[0]).toMatchObject({
      cwd: path,
      args: ["apply", "--index", "--3way", "-"],
      stdin: patch,
      timeoutMs: PATCH_COMMAND_TIMEOUT_MS,
    });

    const outside = join(root, "outside.patch");
    const linked = join(root, "linked.patch");
    await writeFile(outside, patch);
    await symlink(outside, linked);
    await expect(service.importPatch(record.id, linked)).rejects.toMatchObject({
      code: "invalidInput",
    });
    await expect(service.importPatch(record.id, root)).rejects.toMatchObject({
      code: "invalidInput",
    });
    expect(runner.specs).toHaveLength(1);
  });
});

describe("PatchProcessRunner", () => {
  it("preserves stdout bytes and enforces cancellation, timeout, and separate output limits", async () => {
    const root = await temporaryDirectory();
    const executable = join(root, "fake git runner.js");
    await writeFile(
      executable,
      [
        "#!/usr/bin/env node",
        "const mode = process.argv[2];",
        "if (mode === 'bytes') process.stdout.write(Buffer.from([0, 255, 1, 2]));",
        "else if (mode === 'stderr') process.stderr.write('token=super-secret');",
        "else if (mode === 'spam') process.stdout.write(Buffer.alloc(4096, 120));",
        "else setTimeout(() => process.stdout.write('late'), 1000);",
      ].join("\n"),
      "utf8",
    );
    await chmod(executable, 0o700);
    const runner = new PatchProcessRunner(executable);

    await expect(
      runner.run({
        cwd: root,
        args: ["bytes"],
        timeoutMs: 1_000,
        stdoutLimitBytes: 64,
        stderrLimitBytes: 64,
      }),
    ).resolves.toMatchObject({ kind: "completed", stdout: Buffer.from([0, 255, 1, 2]) });
    await expect(
      runner.run({
        cwd: root,
        args: ["stderr"],
        timeoutMs: 1_000,
        stdoutLimitBytes: 64,
        stderrLimitBytes: 64,
      }),
    ).resolves.toMatchObject({
      kind: "completed",
      stdout: Buffer.alloc(0),
      stderr: Buffer.from("token=[redacted]"),
    });
    await expect(
      runner.run({
        cwd: root,
        args: ["spam"],
        timeoutMs: 1_000,
        stdoutLimitBytes: 32,
        stderrLimitBytes: 64,
      }),
    ).resolves.toMatchObject({ kind: "failed", code: "outputLimit" });
    await expect(
      runner.run({
        cwd: root,
        args: ["wait"],
        timeoutMs: 20,
        stdoutLimitBytes: 64,
        stderrLimitBytes: 64,
      }),
    ).resolves.toMatchObject({ kind: "cancelled", reason: "timeout" });
    const controller = new AbortController();
    const running = runner.run(
      {
        cwd: root,
        args: ["wait"],
        timeoutMs: 2_000,
        stdoutLimitBytes: 64,
        stderrLimitBytes: 64,
      },
      controller.signal,
    );
    controller.abort("requested");
    await expect(running).resolves.toMatchObject({ kind: "cancelled", reason: "requested" });
  });
});

describe("PatchService real Git round trip", () => {
  it("preserves Unicode, shell-meta paths, binary data, and secret-like patch payloads", async () => {
    const source = await createRepository("원본 repository");
    const shellMetaName = "shell;$meta-[한글].txt";
    const secretText = [
      "https://alice:secret@example.invalid/repository.git",
      "token=query-secret",
      `ghp_${"a".repeat(32)}`,
      "유니코드 본문",
    ].join("\n");
    await writeFile(join(source, shellMetaName), `${secretText}\n`, "utf8");
    const binary = Buffer.from([0, 255, 1, 2, 3, 0, 128, 64]);
    await writeFile(join(source, "binary.dat"), binary);
    git(source, "add", "--", shellMetaName, "binary.dat");
    git(source, "commit", "-m", "Unicode + secret-like payload");
    const patchCommit = git(source, "rev-parse", "HEAD").trim();
    const baseCommit = git(source, "rev-parse", "HEAD^").trim();

    const sourceRecord = repositoryRecord(source);
    const service = new PatchService(registry(sourceRecord), new PatchProcessRunner());
    const exportDirectory = await temporaryDirectory();
    const exportPath = join(exportDirectory, "round-trip.patch");
    const result = await service.exportPatch(sourceRecord.id, [patchCommit], exportPath);
    const exported = await readFile(exportPath);
    expect(result).toEqual({ path: exportPath, sizeBytes: exported.byteLength, commitCount: 1 });
    expect(exported.includes(Buffer.from("https://alice:secret@"))).toBe(true);
    expect(exported.includes(Buffer.from("token=query-secret"))).toBe(true);
    expect(exported.includes(Buffer.from(`ghp_${"a".repeat(32)}`))).toBe(true);
    expect(exported.includes(Buffer.from("GIT binary patch"))).toBe(true);
    await expect(service.createPatchText(sourceRecord.id, [patchCommit])).resolves.toContain(
      "https://alice:secret@example.invalid/repository.git",
    );

    const targetParent = await temporaryDirectory();
    const target = join(targetParent, "적용 repository");
    git(targetParent, "clone", "--no-local", source, target);
    git(target, "reset", "--hard", baseCommit);
    const targetRecord = repositoryRecord(target);
    await new PatchService(registry(targetRecord), new PatchProcessRunner()).importPatch(
      targetRecord.id,
      exportPath,
    );

    expect(await readFile(join(target, shellMetaName), "utf8")).toBe(`${secretText}\n`);
    expect(await readFile(join(target, "binary.dat"))).toEqual(binary);
    expect(git(target, "diff", "--cached", "--name-only", "-z").split("\0")).toEqual(
      expect.arrayContaining([shellMetaName, "binary.dat"]),
    );

    const marker = join(exportDirectory, `shell-marker-${randomUUID()}`);
    const shellMetaRevision = `HEAD;touch\u0024{IFS}${marker}`;
    await expect(
      service.createPatchText(sourceRecord.id, [shellMetaRevision]),
    ).rejects.toBeInstanceOf(GitUtilityError);
    await expect(access(marker)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
