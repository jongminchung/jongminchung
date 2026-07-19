import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { TerminalEventEnvelope } from "../../../src/shared/contracts/terminal";
import { NodePtySpawner } from "./node-pty-spawner";
import { TerminalLaunchTargetResolver } from "./terminal-launch-target-resolver";
import { TerminalUtility } from "./terminal-utility";

const REQUEST_ID = "388ac97b-6f01-4e10-8149-78ec15412d18";
const REPOSITORY_ID = "02fc7f7c-3f66-514b-9470-451a776cfcc7";
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe.runIf(process.platform !== "win32")("NodePtySpawner integration", () => {
  it("starts an allowlisted predefined shell in the disposable repository cwd", async () => {
    const repository = await mkdtemp(join(tmpdir(), "git-client-terminal-pty-"));
    temporaryDirectories.push(repository);
    const environment = { PATH: "/usr/bin:/bin" };
    const utility = TerminalUtility.of(new NodePtySpawner(), {
      shell: "/bin/sh",
      environment,
      launchTargetResolver: TerminalLaunchTargetResolver.of({
        defaultShell: "/bin/sh",
        environment,
      }),
    });
    const events: TerminalEventEnvelope[] = [];
    let finish: () => void = () => undefined;
    const exited = new Promise<void>((resolve) => {
      finish = resolve;
    });

    const terminal = utility.create(
      {
        requestId: REQUEST_ID,
        repositoryId: REPOSITORY_ID,
        cwd: repository,
        cols: 100,
        rows: 28,
        target: { kind: "shell", id: "sh" },
      },
      (event) => {
        events.push(event);
        if (event.kind === "exited" || event.kind === "failed") finish();
      },
    );
    utility.write({
      terminalId: terminal.terminalId,
      data: "printf '__GIT_CLIENT_PREDEFINED__\\n'; pwd; exit\r",
    });

    let rejectTimeout: (error: Error) => void = () => undefined;
    const timeoutFailure = new Promise<never>((_resolve, reject) => {
      rejectTimeout = reject;
    });
    const timeout = setTimeout(
      () => rejectTimeout(new Error("PTY did not exit")),
      5_000,
    );
    timeout.unref();
    try {
      await Promise.race([exited, timeoutFailure]);
    } finally {
      clearTimeout(timeout);
    }
    const output = new TextDecoder().decode(
      Uint8Array.from(
        events.flatMap((event) => (event.kind === "output" ? event.data : [])),
      ),
    );
    expect(output).toContain("__GIT_CLIENT_PREDEFINED__");
    expect(output).toContain(repository);
    expect(events.at(-1)).toMatchObject({ kind: "exited", exitCode: 0 });
    expect(utility.sessionCount).toBe(0);
  });
});
