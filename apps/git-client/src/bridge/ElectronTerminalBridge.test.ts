import { describe, expect, it } from "vitest";
import type { RepositoryId, TerminalEvent, TerminalId } from "../shared/contracts/model";
import {
  DEFAULT_TERMINAL_LAUNCH_TARGET,
  type TerminalLaunchTarget,
  type TerminalLaunchTargets,
} from "../shared/contracts/terminal";
import { ElectronTerminalBridge, type ElectronTerminalApi } from "./ElectronTerminalBridge";

class FakeElectronTerminalApi implements ElectronTerminalApi {
  readonly writes: Array<{ readonly terminalId: string; readonly data: string }> = [];
  readonly resizes: Array<{
    readonly terminalId: string;
    readonly cols: number;
    readonly rows: number;
  }> = [];
  readonly closed: string[] = [];
  readonly closedRepositories: string[] = [];

  listLaunchTargets(): Promise<TerminalLaunchTargets> {
    return Promise.resolve({
      shells: [{ kind: "shell", id: "zsh", displayName: "Zsh" }],
      agents: [],
    });
  }

  async create(
    _repositoryId: RepositoryId,
    _cols: number,
    _rows: number,
    _target: TerminalLaunchTarget,
    listener: (event: TerminalEvent) => void,
  ): Promise<TerminalId> {
    listener({ kind: "output", sequence: 0, data: [112, 119, 100, 13, 10] });
    return "f6478d5c-5aa0-4d4a-b646-cb950b0ca555";
  }

  async write(terminalId: TerminalId, data: string): Promise<void> {
    this.writes.push({ terminalId, data });
  }

  async resize(terminalId: TerminalId, cols: number, rows: number): Promise<void> {
    this.resizes.push({ terminalId, cols, rows });
  }

  async close(terminalId: TerminalId): Promise<void> {
    this.closed.push(terminalId);
  }

  async closeRepository(repositoryId: RepositoryId): Promise<void> {
    this.closedRepositories.push(repositoryId);
  }
}

describe("ElectronTerminalBridge", () => {
  it("creates a terminal and forwards its ordered output through the desktop API", async () => {
    const api = new FakeElectronTerminalApi();
    const bridge = ElectronTerminalBridge.of(api);
    const events: TerminalEvent[] = [];

    const terminalId = await bridge.create(
      "dfca5b34-8cce-4e7f-a497-646bca8ed42d",
      100,
      28,
      DEFAULT_TERMINAL_LAUNCH_TARGET,
      (event) => events.push(event),
    );
    await expect(bridge.listLaunchTargets()).resolves.toEqual({
      shells: [{ kind: "shell", id: "zsh", displayName: "Zsh" }],
      agents: [],
    });
    await bridge.write(terminalId, "pwd\r");
    await bridge.resize(terminalId, 120, 36);
    await bridge.close(terminalId);
    await bridge.closeRepository("dfca5b34-8cce-4e7f-a497-646bca8ed42d");

    expect(events).toEqual([{ kind: "output", sequence: 0, data: [112, 119, 100, 13, 10] }]);
    expect(api.writes).toEqual([{ terminalId, data: "pwd\r" }]);
    expect(api.resizes).toEqual([{ terminalId, cols: 120, rows: 36 }]);
    expect(api.closed).toEqual([terminalId]);
    expect(api.closedRepositories).toEqual(["dfca5b34-8cce-4e7f-a497-646bca8ed42d"]);
  });
});
