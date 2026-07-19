import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { afterEach, describe, expect, it } from "vitest";
import type { GitOperation, RebasePlanEntry } from "../../../src/generated";
import { SequenceEditorSession } from "./sequence-editor";
import { createSequenceEditorCommand } from "./sequence-editor-cli";

const temporaryDirectories: string[] = [];

function runGit(
  repository: string,
  arguments_: readonly string[],
  environment: Readonly<NodeJS.ProcessEnv> = {},
): string {
  const result = spawnSync("git", arguments_, {
    cwd: repository,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_NOSYSTEM: "1",
      LC_ALL: "C",
      TZ: "UTC",
      ...environment,
    },
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`git ${arguments_.join(" ")} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function planEntry(
  oid: string,
  subject: string,
  action: RebasePlanEntry["action"] = "pick",
  message: string | null = null,
): RebasePlanEntry {
  return {
    oid,
    subject,
    parents: [],
    action,
    message,
    published: false,
    mergeCommit: false,
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("sequence editor Git integration", () => {
  it("runs a real interactive rebase with shell:false and no command injection", async () => {
    const root = await mkdtemp(join(tmpdir(), "git-client-rebase-integration-"));
    temporaryDirectories.push(root);
    const repository = join(root, "repository with spaces");
    await mkdir(repository);
    runGit(repository, ["init", "--initial-branch=main"]);
    runGit(repository, ["config", "user.name", "Git Client Test"]);
    runGit(repository, ["config", "user.email", "git-client@example.invalid"]);
    const trackedPath = join(repository, "tracked.txt");
    for (const subject of ["first", "second", "third"]) {
      await writeFile(trackedPath, `${subject}\n`, { flag: "a" });
      runGit(repository, ["add", "--", "tracked.txt"]);
      runGit(repository, ["commit", "-m", subject]);
    }
    const commits = runGit(repository, ["log", "--reverse", "--format=%H%x09%s"])
      .trim()
      .split("\n")
      .map((line) => {
        const separator = line.indexOf("\t");
        return {
          oid: line.slice(0, separator),
          subject: line.slice(separator + 1),
        };
      });
    const entries = commits.map((commit) =>
      commit.subject === "second"
        ? planEntry(commit.oid, commit.subject, "reword", "second rewritten")
        : planEntry(commit.oid, commit.subject),
    );
    const operation: GitOperation = {
      kind: "interactiveRebase",
      base: null,
      entries,
      options: {
        autostash: false,
        updateRefs: false,
        preserveMerges: false,
      },
    };
    const session = await SequenceEditorSession.create(join(repository, ".git"), operation);
    try {
      const helperDirectory = join(root, "helper'; touch COMMAND_INJECTION; echo '");
      const entryPath = join(helperDirectory, "sequence-editor.cjs");
      await build({
        configFile: false,
        logLevel: "silent",
        build: {
          emptyOutDir: true,
          outDir: helperDirectory,
          rollupOptions: {
            input: fileURLToPath(new URL("./sequence-editor-entry.ts", import.meta.url)),
            output: {
              entryFileNames: "sequence-editor.cjs",
              format: "cjs",
            },
          },
          ssr: true,
          target: "node22",
        },
        ssr: { noExternal: true },
      });

      runGit(repository, ["rebase", "-i", "--root"], {
        GIT_SEQUENCE_EDITOR: createSequenceEditorCommand({
          executablePath: process.execPath,
          entryPath,
          mode: "sequence",
          session,
        }),
        GIT_EDITOR: createSequenceEditorCommand({
          executablePath: process.execPath,
          entryPath,
          mode: "message",
          session,
        }),
      });

      expect(runGit(repository, ["log", "--reverse", "--format=%s"]).trim().split("\n")).toEqual([
        "first",
        "second rewritten",
        "third",
      ]);
      await expect(readFile(join(repository, "COMMAND_INJECTION"), "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
    } finally {
      await session.cleanup();
    }
  });
});
