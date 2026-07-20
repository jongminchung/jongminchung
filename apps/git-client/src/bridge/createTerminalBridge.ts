import { electronApi } from "../platform/electron";
import type { RepositoryId, TerminalEvent, TerminalId } from "../shared/contracts/model";
import type { TerminalLaunchTarget, TerminalLaunchTargets } from "../shared/contracts/terminal";
import { ElectronTerminalBridge } from "./ElectronTerminalBridge";
import type { TerminalBridge } from "./TerminalBridge";

class UnavailableTerminalBridge implements TerminalBridge {
  listLaunchTargets(): Promise<TerminalLaunchTargets> {
    return Promise.resolve({ shells: [], agents: [] });
  }

  create(
    _repositoryId: RepositoryId,
    _cols: number,
    _rows: number,
    _target: TerminalLaunchTarget,
    _onEvent: (event: TerminalEvent) => void,
  ): Promise<TerminalId> {
    return Promise.reject(new Error("Terminal is available in the Electron app."));
  }

  write(_terminalId: TerminalId, _data: string): Promise<void> {
    return Promise.reject(new Error("Terminal is available in the Electron app."));
  }

  resize(_terminalId: TerminalId, _cols: number, _rows: number): Promise<void> {
    return Promise.reject(new Error("Terminal is available in the Electron app."));
  }

  close(_terminalId: TerminalId): Promise<void> {
    return Promise.resolve();
  }

  closeRepository(_repositoryId: RepositoryId): Promise<void> {
    return Promise.resolve();
  }
}

export function createTerminalBridge(): TerminalBridge {
  const api = electronApi();
  if (api !== null) return ElectronTerminalBridge.of(api.terminal);
  return new UnavailableTerminalBridge();
}
