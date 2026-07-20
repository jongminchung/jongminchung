import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { GitOperation, RebasePlanEntry } from "../../../src/shared/contracts/model";
import { SequenceEditorSession } from "./sequence-editor";
import {
  SEQUENCE_EDITOR_APPLICATION_ARGUMENT,
  createApplicationSequenceEditorCommand,
  runSequenceEditorCli,
} from "./sequence-editor-cli";

const temporaryDirectories: string[] = [];

function operation(): GitOperation {
  const entry: RebasePlanEntry = {
    oid: "1".repeat(40),
    subject: "first",
    parents: [],
    action: "reword",
    message: "replacement",
    published: false,
    mergeCommit: false,
  };
  return {
    kind: "interactiveRebase",
    base: null,
    entries: [entry],
    options: {
      autostash: false,
      updateRefs: false,
      preserveMerges: false,
    },
  };
}

async function fixture(): Promise<{
  readonly gitDirectory: string;
  readonly todoPath: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "git-client-sequence-cli-"));
  temporaryDirectories.push(root);
  const gitDirectory = join(root, ".git");
  const rebaseDirectory = join(gitDirectory, "rebase-merge");
  await mkdir(rebaseDirectory, { recursive: true });
  return {
    gitDirectory,
    todoPath: join(rebaseDirectory, "git-rebase-todo"),
  };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("runSequenceEditorCli", () => {
  it("builds a quoted packaged-application command without exposing an arbitrary entry script", async () => {
    const { gitDirectory } = await fixture();
    const session = await SequenceEditorSession.create(gitDirectory, operation());

    const command = createApplicationSequenceEditorCommand({
      executablePath: "/Applications/Git Client.app/Contents/MacOS/Git Client",
      applicationEntryPath: null,
      mode: "sequence",
      session,
    });

    expect(command).toContain(`'${SEQUENCE_EDITOR_APPLICATION_ARGUMENT}' '--sequence-editor'`);
    expect(command).toContain(`'${session.payloadPath}' '--nonce' '${session.nonce}'`);
    expect(command).not.toContain("sequence-editor.cjs");
    await session.cleanup();
  });

  it("applies a utility-created plan from fixed positional arguments", async () => {
    const { gitDirectory, todoPath } = await fixture();
    await writeFile(todoPath, "pick 1111111 first\n", "utf8");
    const session = await SequenceEditorSession.create(gitDirectory, operation());
    let stderr = "";

    const exitCode = await runSequenceEditorCli(
      ["--sequence-editor", "--payload", session.payloadPath, "--nonce", session.nonce, todoPath],
      { writeError: (text) => (stderr += text) },
    );

    expect(exitCode).toBe(0);
    expect(stderr).toBe("");
    await expect(readFile(todoPath, "utf8")).resolves.toBe("reword 1111111 first\n");
    await session.cleanup();
  });

  it("rejects missing, reordered, or extra arguments", async () => {
    let stderr = "";

    const exitCode = await runSequenceEditorCli(
      ["--sequence-editor", "--payload", "/tmp/payload.json"],
      { writeError: (text) => (stderr += text) },
    );

    expect(exitCode).toBe(2);
    expect(stderr).toContain("Invalid sequence editor arguments");
  });

  it("redacts credentials and never echoes the nonce on IO failure", async () => {
    const { gitDirectory, todoPath } = await fixture();
    await writeFile(todoPath, "pick 1111111 first\n", "utf8");
    const secret = "very-secret-token";
    const nonce = "a".repeat(64);
    const missingPayload = join(gitDirectory, `token=${secret}`, "payload.json");
    let stderr = "";

    const exitCode = await runSequenceEditorCli(
      ["--sequence-editor", "--payload", missingPayload, "--nonce", nonce, todoPath],
      { writeError: (text) => (stderr += text) },
    );

    expect(exitCode).toBe(2);
    expect(stderr).toContain("[redacted]");
    expect(stderr).not.toContain(secret);
    expect(stderr).not.toContain(nonce);
  });

  it("redacts the nonce when untrusted todo content repeats it in an error", async () => {
    const { gitDirectory, todoPath } = await fixture();
    const session = await SequenceEditorSession.create(gitDirectory, operation());
    await writeFile(todoPath, `pick ${session.nonce} attacker-controlled\n`, "utf8");
    let stderr = "";

    const exitCode = await runSequenceEditorCli(
      ["--sequence-editor", "--payload", session.payloadPath, "--nonce", session.nonce, todoPath],
      { writeError: (text) => (stderr += text) },
    );

    expect(exitCode).toBe(2);
    expect(stderr).toContain("[redacted]");
    expect(stderr).not.toContain(session.nonce);
    await session.cleanup();
  });
});
