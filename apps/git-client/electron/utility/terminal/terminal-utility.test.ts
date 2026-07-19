import { describe, expect, it, vi } from "vitest";
import type { TerminalEventEnvelope } from "../../../src/shared/contracts/terminal";
import {
  TerminalUtility,
  type PtyProcess,
  type PtyProcessExit,
  type PtySpawnOptions,
  type PtySpawner,
} from "./terminal-utility";

const REQUEST_ID = "388ac97b-6f01-4e10-8149-78ec15412d18";
const REPOSITORY_ID = "02fc7f7c-3f66-514b-9470-451a776cfcc7";

class FakePtyProcess implements PtyProcess {
  readonly writes: string[] = [];
  readonly resizes: Array<{ readonly cols: number; readonly rows: number }> = [];
  readonly dataListeners = new Set<(data: string) => void>();
  readonly exitListeners = new Set<(event: PtyProcessExit) => void>();
  killCount = 0;

  onData(listener: (data: string) => void): () => void {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  onExit(listener: (event: PtyProcessExit) => void): () => void {
    this.exitListeners.add(listener);
    return () => this.exitListeners.delete(listener);
  }

  write(data: string): void {
    this.writes.push(data);
  }

  resize(cols: number, rows: number): void {
    this.resizes.push({ cols, rows });
  }

  kill(): void {
    this.killCount += 1;
  }

  emitData(data: string): void {
    for (const listener of this.dataListeners) listener(data);
  }

  emitExit(event: PtyProcessExit): void {
    for (const listener of this.exitListeners) listener(event);
  }
}

class FakePtySpawner implements PtySpawner {
  readonly process = new FakePtyProcess();
  readonly spawn = vi.fn(
    (_shell: string, _args: readonly string[], _options: PtySpawnOptions): PtyProcess =>
      this.process,
  );
}

describe("TerminalUtility", () => {
  it("runs the fixed shell in the repository and emits sequential output before exit", () => {
    const spawner = new FakePtySpawner();
    const utility = TerminalUtility.of(spawner, {
      shell: "/bin/zsh",
      environment: { PATH: "/usr/bin:/bin" },
    });
    const events: TerminalEventEnvelope[] = [];

    const result = utility.create(
      {
        requestId: REQUEST_ID,
        repositoryId: REPOSITORY_ID,
        cwd: "/tmp/repository",
        cols: 100,
        rows: 28,
      },
      (event) => events.push(event),
    );
    spawner.process.emitData("pwd\r\n");
    spawner.process.emitData("/tmp/repository\r\n");
    spawner.process.emitExit({ exitCode: 0, signal: null });

    expect(spawner.spawn).toHaveBeenCalledWith("/bin/zsh", [], {
      cwd: "/tmp/repository",
      cols: 100,
      rows: 28,
      env: {
        PATH: "/usr/bin:/bin",
        COLORTERM: "truecolor",
        TERM: "xterm-256color",
        TERM_PROGRAM: "GitClient",
      },
      name: "xterm-256color",
    });
    expect(events).toEqual([
      {
        kind: "output",
        requestId: REQUEST_ID,
        terminalId: result.terminalId,
        sequence: 0,
        data: Array.from(new TextEncoder().encode("pwd\r\n")),
      },
      {
        kind: "output",
        requestId: REQUEST_ID,
        terminalId: result.terminalId,
        sequence: 1,
        data: Array.from(new TextEncoder().encode("/tmp/repository\r\n")),
      },
      {
        kind: "exited",
        requestId: REQUEST_ID,
        terminalId: result.terminalId,
        exitCode: 0,
        signal: null,
      },
    ]);
    expect(utility.sessionCount).toBe(0);
  });

  it("bounds output chunks and closes only sessions owned by the requested repository", () => {
    const firstSpawner = new FakePtySpawner();
    const secondSpawner = new FakePtySpawner();
    const spawners = [firstSpawner, secondSpawner];
    const utility = TerminalUtility.of(
      {
        spawn: (...args) => {
          const spawner = spawners.shift();
          if (spawner === undefined) throw new Error("Unexpected PTY spawn");
          return spawner.spawn(...args);
        },
      },
      { shell: "/bin/zsh", environment: {} },
    );
    const events: TerminalEventEnvelope[] = [];
    const first = utility.create(
      {
        requestId: REQUEST_ID,
        repositoryId: REPOSITORY_ID,
        cwd: "/tmp/repository",
        cols: 80,
        rows: 24,
      },
      (event) => events.push(event),
    );
    const second = utility.create(
      {
        requestId: "cf6adbd1-d56d-4ba6-9407-7906f448ba91",
        repositoryId: "db781fb0-c689-44bc-aa5f-84a9af7506fa",
        cwd: "/tmp/other-repository",
        cols: 80,
        rows: 24,
      },
      () => undefined,
    );

    utility.write({ terminalId: first.terminalId, data: "git status\r" });
    utility.resize({ terminalId: first.terminalId, cols: 120, rows: 40 });
    firstSpawner.process.emitData("x".repeat(40_000));
    expect(utility.closeRepository({ repositoryId: REPOSITORY_ID })).toBe(1);

    expect(firstSpawner.process.writes).toEqual(["git status\r"]);
    expect(firstSpawner.process.resizes).toEqual([{ cols: 120, rows: 40 }]);
    expect(
      events
        .filter((event) => event.kind === "output")
        .map((event) => (event.kind === "output" ? event.data.length : 0)),
    ).toEqual([32 * 1024, 40_000 - 32 * 1024]);
    expect(firstSpawner.process.killCount).toBe(1);
    expect(secondSpawner.process.killCount).toBe(0);
    expect(utility.sessionCount).toBe(1);

    utility.close({ terminalId: second.terminalId });
    expect(secondSpawner.process.killCount).toBe(1);
    expect(utility.sessionCount).toBe(0);
  });

  it("reports PTY spawn failures with a recoverable typed error", () => {
    const utility = TerminalUtility.of(
      {
        spawn: () => {
          throw new Error("posix_spawn failed");
        },
      },
      { shell: "/bin/zsh", environment: {} },
    );

    expect(() =>
      utility.create(
        {
          requestId: REQUEST_ID,
          repositoryId: REPOSITORY_ID,
          cwd: "/tmp/repository",
          cols: 80,
          rows: 24,
        },
        () => undefined,
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "spawnFailed",
        message: "Unable to start terminal shell: posix_spawn failed",
      }),
    );
  });
});
