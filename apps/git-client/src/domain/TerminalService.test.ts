import { describe, expect, it, vi } from "vitest";
import type { TerminalBridge } from "../bridge/TerminalBridge";
import type { RepositoryId, TerminalEvent, TerminalId } from "../shared/contracts/model";
import type { TerminalLaunchTarget, TerminalLaunchTargets } from "../shared/contracts/terminal";
import { TerminalService } from "./TerminalService";

class FakeTerminalBridge implements TerminalBridge {
  readonly createCalls: Array<{ repositoryId: string; cols: number; rows: number }> = [];
  readonly writes: Array<{ terminalId: string; data: string }> = [];
  readonly resizes: Array<{ terminalId: string; cols: number; rows: number }> = [];
  readonly closes: string[] = [];
  readonly repositoryCloses: string[] = [];
  onEvent?: (event: TerminalEvent) => void;

  listLaunchTargets(): Promise<TerminalLaunchTargets> {
    return Promise.resolve({ shells: [], agents: [] });
  }

  async create(
    repositoryId: RepositoryId,
    cols: number,
    rows: number,
    _target: TerminalLaunchTarget,
    onEvent: (event: TerminalEvent) => void,
  ): Promise<TerminalId> {
    this.createCalls.push({ repositoryId, cols, rows });
    this.onEvent = onEvent;
    return "terminal-1";
  }

  async write(terminalId: TerminalId, data: string): Promise<void> {
    this.writes.push({ terminalId, data });
  }

  async resize(terminalId: TerminalId, cols: number, rows: number): Promise<void> {
    this.resizes.push({ terminalId, cols, rows });
  }

  async close(terminalId: TerminalId): Promise<void> {
    this.closes.push(terminalId);
  }

  async closeRepository(repositoryId: RepositoryId): Promise<void> {
    this.repositoryCloses.push(repositoryId);
  }
}

describe("TerminalService", () => {
  it("keeps PTY sessions per repository and forwards their lifecycle", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "ui-session-1" });
    const bridge = new FakeTerminalBridge();
    const service = TerminalService.of(bridge);
    const key = await service.create("repository-a", { title: "Feature shell" });

    expect(key).toBe("ui-session-1");
    expect(bridge.createCalls).toEqual([{ repositoryId: "repository-a", cols: 100, rows: 28 }]);
    expect(service.sessions("repository-b")).toHaveLength(0);
    expect(service.sessions("repository-a")[0]).toMatchObject({
      title: "Feature shell",
      status: "running",
      terminalId: "terminal-1",
    });

    const received: TerminalEvent[] = [];
    service.subscribeEvents(key, (event) => received.push(event));
    bridge.onEvent?.({ kind: "output", sequence: 3, data: [112, 119, 100] });
    bridge.onEvent?.({ kind: "exited", exitCode: 130, signal: "SIGINT" });
    expect(received.map((event) => event.kind)).toEqual(["output", "exited"]);
    expect(service.events(key)).toEqual(received);
    expect(service.sessions("repository-a")[0]).toMatchObject({
      status: "exited",
      exitCode: 130,
    });

    await service.write(key, "pwd\r");
    await service.resize(key, 120, 36);
    expect(bridge.writes).toEqual([{ terminalId: "terminal-1", data: "pwd\r" }]);
    expect(bridge.resizes).toEqual([{ terminalId: "terminal-1", cols: 120, rows: 36 }]);

    await service.closeRepository("repository-a");
    expect(service.sessions("repository-a")).toHaveLength(0);
    expect(bridge.repositoryCloses).toEqual(["repository-a"]);
    vi.unstubAllGlobals();
  });

  it("does not overwrite an exit delivered before Electron create resolves", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "ui-session-2" });
    const bridge = new FakeTerminalBridge();
    bridge.create = async (
      repositoryId: RepositoryId,
      cols: number,
      rows: number,
      _target: TerminalLaunchTarget,
      onEvent: (event: TerminalEvent) => void,
    ): Promise<TerminalId> => {
      bridge.createCalls.push({ repositoryId, cols, rows });
      onEvent({ kind: "exited", exitCode: 0, signal: null });
      return "terminal-2";
    };
    const service = TerminalService.of(bridge);

    await service.create("repository-a");

    expect(service.sessions("repository-a")[0]).toMatchObject({
      title: "Local",
      terminalId: "terminal-2",
      status: "exited",
      exitCode: 0,
    });
    vi.unstubAllGlobals();
  });

  it("makes concurrent restore callers wait for the same restored terminal state", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "ui-session-restored" });
    let finishRead: (value: unknown) => void = () => undefined;
    const read = new Promise<unknown>((resolve) => {
      finishRead = resolve;
    });
    const get = vi.fn(async () => read);
    const set = vi.fn(async () => undefined);
    vi.stubGlobal("window", {
      gitClient: { settings: { get, set, delete: vi.fn() } },
    });
    const bridge = new FakeTerminalBridge();
    const service = TerminalService.of(bridge);

    const first = service.restore("repository-a");
    let secondSettled = false;
    const second = service.restore("repository-a").finally(() => {
      secondSettled = true;
    });
    await Promise.resolve();
    expect(secondSettled).toBe(false);

    finishRead({ "repository-a": ["Local"] });
    await Promise.all([first, second]);
    expect(get).toHaveBeenCalledTimes(1);
    expect(bridge.createCalls).toEqual([{ repositoryId: "repository-a", cols: 100, rows: 28 }]);
    expect(service.sessions("repository-a")).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it("retains a create failure as a terminal event for the xterm surface", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "ui-session-failed" });
    const bridge = new FakeTerminalBridge();
    bridge.create = async (): Promise<TerminalId> => {
      throw new Error("Unable to start terminal shell: EACCES");
    };
    const service = TerminalService.of(bridge);

    const key = await service.create("repository-a");

    expect(service.sessions("repository-a")[0]).toMatchObject({
      status: "failed",
      error: "Unable to start terminal shell: EACCES",
    });
    expect(service.events(key)).toEqual([
      { kind: "failed", message: "Unable to start terminal shell: EACCES" },
    ]);
    vi.unstubAllGlobals();
  });
});
