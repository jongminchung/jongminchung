import { spawnSync } from "node:child_process";
import { getEventListeners } from "node:events";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GitProcessRunner } from "./git-process";

const temporaryDirectories: string[] = [];

function git(cwd: string, ...args: readonly string[]): void {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(" ")} failed`);
}

function stdout(outcome: Awaited<ReturnType<GitProcessRunner["run"]>>): string {
  return outcome.output
    .filter((entry) => entry.stream === "stdout")
    .map((entry) => entry.data)
    .join("");
}

async function waitFor<T>(load: () => Promise<T | null>, timeoutMs = 3_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await load();
    if (value !== null) return value;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Condition was not met within ${timeoutMs} ms`);
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(error instanceof Error && "code" in error && error.code === "ESRCH");
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("GitProcessRunner output policy", () => {
  it("preserves chronological order when stdout and stderr alternate", async () => {
    const root = await mkdtemp(join(tmpdir(), "git-client-process-order-"));
    temporaryDirectories.push(root);
    const fakeGit = join(root, "alternating-git");
    await writeFile(
      fakeGit,
      [
        `#!${process.execPath}`,
        "process.stdout.write('stdout-1\\n');",
        "setTimeout(() => process.stderr.write('stderr-1\\n'), 20);",
        "setTimeout(() => process.stdout.write('stdout-2\\n'), 40);",
        "setTimeout(() => process.exit(0), 60);",
        "",
      ].join("\n"),
      "utf8",
    );
    await chmod(fakeGit, 0o755);

    const outcome = await new GitProcessRunner(fakeGit).run({
      cwd: root,
      args: ["status"],
      redactStdout: false,
    });

    expect(outcome.kind).toBe("completed");
    expect(outcome.output).toEqual([
      { stream: "stdout", data: "stdout-1\n" },
      { stream: "stderr", data: "stderr-1\n" },
      { stream: "stdout", data: "stdout-2\n" },
    ]);
  });

  it("preserves repository-owned stdout only when the caller explicitly opts out of redaction", async () => {
    const root = await mkdtemp(join(tmpdir(), "git-client-process-output-"));
    temporaryDirectories.push(root);
    git(root, "init", "--initial-branch=main");
    git(root, "config", "test.value", "token=repository-owned-value");
    const runner = new GitProcessRunner();

    const preserved = await runner.run({
      cwd: root,
      args: ["config", "--get", "test.value"],
      redactStdout: false,
    });
    expect(preserved.kind).toBe("completed");
    expect(stdout(preserved)).toBe("token=repository-owned-value\n");

    const protectedByDefault = await runner.run({
      cwd: root,
      args: ["config", "--get", "test.value"],
    });
    expect(protectedByDefault.kind).toBe("completed");
    expect(stdout(protectedByDefault)).toBe("token=[redacted]\n");
  });

  it("terminates an actual child process on AbortController cancellation without retaining listeners", async () => {
    const root = await mkdtemp(join(tmpdir(), "git-client-process-cancel-"));
    temporaryDirectories.push(root);
    const fakeGit = join(root, "blocking-git");
    await writeFile(
      fakeGit,
      [
        `#!${process.execPath}`,
        "process.stdout.write('started\\n');",
        "setInterval(() => undefined, 1_000);",
        "",
      ].join("\n"),
      "utf8",
    );
    await chmod(fakeGit, 0o755);
    const runner = new GitProcessRunner(fakeGit);
    const cancellation = new AbortController();

    const pending = runner.run(
      { cwd: root, args: ["status"], timeoutMs: 5_000 },
      cancellation.signal,
    );
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(getEventListeners(cancellation.signal, "abort")).toHaveLength(1);
    cancellation.abort("repositoryClosed");

    await expect(pending).resolves.toMatchObject({
      kind: "cancelled",
      reason: "repositoryClosed",
    });
    expect(getEventListeners(cancellation.signal, "abort")).toHaveLength(0);
  });

  it.runIf(process.platform !== "win32")(
    "terminates the complete process group, including a grandchild that ignores SIGTERM",
    async () => {
      const root = await mkdtemp(join(tmpdir(), "git-client-process-tree-cancel-"));
      temporaryDirectories.push(root);
      const fakeGit = join(root, "process-tree-git");
      const grandchildPidPath = join(root, "grandchild.pid");
      const grandchildScript = [
        "const { writeFileSync } = require('node:fs');",
        "process.on('SIGTERM', () => undefined);",
        "writeFileSync(process.argv[1], String(process.pid), 'utf8');",
        "setInterval(() => undefined, 1_000);",
      ].join("\n");
      await writeFile(
        fakeGit,
        [
          `#!${process.execPath}`,
          "const { spawn } = require('node:child_process');",
          `spawn(process.execPath, ['-e', ${JSON.stringify(grandchildScript)}, process.argv[2]], { stdio: 'ignore' });`,
          "process.stdout.write('started\\n');",
          "setInterval(() => undefined, 1_000);",
          "",
        ].join("\n"),
        "utf8",
      );
      await chmod(fakeGit, 0o755);
      const cancellation = new AbortController();
      const pending = new GitProcessRunner(fakeGit).run(
        { cwd: root, args: [grandchildPidPath], timeoutMs: 5_000 },
        cancellation.signal,
      );
      const grandchildPid = await waitFor(async () => {
        try {
          return Number.parseInt(await readFile(grandchildPidPath, "utf8"), 10);
        } catch {
          return null;
        }
      });

      try {
        expect(processExists(grandchildPid)).toBe(true);
        cancellation.abort("requested");
        await expect(pending).resolves.toMatchObject({
          kind: "cancelled",
          reason: "requested",
        });
        await waitFor(async () => (processExists(grandchildPid) ? null : true));
        expect(processExists(grandchildPid)).toBe(false);
      } finally {
        if (processExists(grandchildPid)) process.kill(grandchildPid, "SIGKILL");
      }
    },
  );
});
