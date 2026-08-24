import { describe, expect, it, vi } from "vitest";
import {
  RepositoryAccessPolicy,
  SafeModeViolationError,
} from "../../domain/repositoryAccess";
import type {
  RepositoryId,
  TerminalEvent,
  TerminalId,
} from "../../shared/contracts/model/index";
import type {
  TerminalLaunchTarget,
  TerminalLaunchTargets,
} from "../../shared/contracts/terminal";
import type { TerminalPort } from "./ports/TerminalPort";
import type { TerminalSettingsPort } from "./ports/TerminalSettingsPort";
import { TerminalService } from "./TerminalService";

class FakeTerminalPort implements TerminalPort {
  readonly createCalls: Array<{
    repositoryId: string;
    cols: number;
    rows: number;
  }> = [];
  readonly writes: Array<{ terminalId: string; data: string }> = [];
  readonly resizes: Array<{
    terminalId: string;
    cols: number;
    rows: number;
  }> = [];
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

  async resize(
    terminalId: TerminalId,
    cols: number,
    rows: number,
  ): Promise<void> {
    this.resizes.push({ terminalId, cols, rows });
  }

  async close(terminalId: TerminalId): Promise<void> {
    this.closes.push(terminalId);
  }

  async closeRepository(repositoryId: RepositoryId): Promise<void> {
    this.repositoryCloses.push(repositoryId);
  }
}

describe("터미널서비스", () => {
  it("[실패] 안전 모드에 대한 PTY 세션을 생성하거나 복원하지 마십시오", async () => {
    const bridge = new FakeTerminalPort();
    const access = RepositoryAccessPolicy.create();
    access.open("repository-a", "/tmp/project-a", "safe");
    access.activate("repository-a");
    const service = TerminalService.of(bridge, access);

    await expect(service.create("repository-a")).rejects.toBeInstanceOf(
      SafeModeViolationError,
    );
    expect(() => service.restore("repository-a")).toThrow(
      SafeModeViolationError,
    );
    expect(() => service.listLaunchTargets()).toThrow(SafeModeViolationError);
    expect(bridge.createCalls).toEqual([]);
  });

  it("[성공] 리포지토리 나비 PTY 세션을 유지하고 생활주기를 전달함", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "ui-session-1" });
    const bridge = new FakeTerminalPort();
    const service = TerminalService.of(bridge);
    const key = await service.create("repository-a", {
      title: "Feature shell",
    });

    expect(key).toBe("ui-session-1");
    expect(bridge.createCalls).toEqual([
      { repositoryId: "repository-a", cols: 100, rows: 28 },
    ]);
    expect(service.sessions("repository-b")).toHaveLength(0);
    expect(service.sessions("repository-a")[0]).toMatchObject({
      title: "Feature shell",
      status: "running",
      terminalId: "terminal-1",
    });

    const received: TerminalEvent[] = [];
    service.subscribeEvents(key, (event) => received.push(event));
    bridge.onEvent?.({
      kind: "output",
      sequence: 3,
      data: [112, 119, 100],
    });
    bridge.onEvent?.({ kind: "exited", exitCode: 130, signal: "SIGINT" });
    expect(received.map((event) => event.kind)).toEqual(["output", "exited"]);
    expect(service.events(key)).toEqual(received);
    expect(service.sessions("repository-a")[0]).toMatchObject({
      status: "exited",
      exitCode: 130,
    });

    await service.write(key, "pwd\r");
    await service.resize(key, 120, 36);
    expect(bridge.writes).toEqual([
      { terminalId: "terminal-1", data: "pwd\r" },
    ]);
    expect(bridge.resizes).toEqual([
      { terminalId: "terminal-1", cols: 120, rows: 36 },
    ]);

    await service.closeRepository("repository-a");
    expect(service.sessions("repository-a")).toHaveLength(0);
    expect(bridge.repositoryCloses).toEqual(["repository-a"]);
    vi.unstubAllGlobals();
  });

  it("[실패] Electron create가 처리되기 전에 전달이 중단되는 현상", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "ui-session-2" });
    const bridge = new FakeTerminalPort();
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

  it("[성공] 복원된 복원자가 동일하게 복원된 터미널 상태를 기다리게 함", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "ui-session-restored" });
    let finishRead: (value: unknown) => void = () => undefined;
    const read = new Promise<unknown>((resolve) => {
      finishRead = resolve;
    });
    const readSettings = vi.fn(async () => read);
    const settings: TerminalSettingsPort = {
      read: readSettings,
      write: vi.fn(async () => undefined),
    };
    const bridge = new FakeTerminalPort();
    const service = TerminalService.of(bridge, undefined, settings);

    const first = service.restore("repository-a");
    let secondSettled = false;
    const second = service.restore("repository-a").finally(() => {
      secondSettled = true;
    });
    await Promise.resolve();
    expect(secondSettled).toBe(false);

    finishRead({ "repository-a": ["Local"] });
    await Promise.all([first, second]);
    expect(readSettings).toHaveBeenCalledTimes(1);
    expect(bridge.createCalls).toEqual([
      { repositoryId: "repository-a", cols: 100, rows: 28 },
    ]);
    expect(service.sessions("repository-a")).toHaveLength(1);
  });

  it("[성공] xterm 표면에 대한 터미널 이벤트를 생성하지 못함을 유지함", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "ui-session-failed" });
    const bridge = new FakeTerminalPort();
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
      {
        kind: "failed",
        message: "Unable to start terminal shell: EACCES",
      },
    ]);
    vi.unstubAllGlobals();
  });
});
