import type { RepositoryId, TerminalEvent, TerminalId } from "../shared/contracts/model";
import type { TerminalLaunchTarget, TerminalLaunchTargets } from "../shared/contracts/terminal";
import type { TerminalBridge } from "./TerminalBridge";

export interface ElectronTerminalApi {
  listLaunchTargets(): Promise<TerminalLaunchTargets>;
  create(
    repositoryId: RepositoryId,
    cols: number,
    rows: number,
    target: TerminalLaunchTarget,
    listener: (event: TerminalEvent) => void,
  ): Promise<TerminalId>;
  write(terminalId: TerminalId, data: string): Promise<void>;
  resize(terminalId: TerminalId, cols: number, rows: number): Promise<void>;
  close(terminalId: TerminalId): Promise<void>;
  closeRepository(repositoryId: RepositoryId): Promise<void>;
}

export class ElectronTerminalBridge implements TerminalBridge {
  readonly #api: ElectronTerminalApi;

  private constructor(api: ElectronTerminalApi) {
    this.#api = api;
  }

  static of(api: ElectronTerminalApi): ElectronTerminalBridge {
    return new ElectronTerminalBridge(api);
  }

  listLaunchTargets(): Promise<TerminalLaunchTargets> {
    return this.#api.listLaunchTargets();
  }

  create(
    repositoryId: RepositoryId,
    cols: number,
    rows: number,
    target: TerminalLaunchTarget,
    onEvent: (event: TerminalEvent) => void,
  ): Promise<TerminalId> {
    return this.#api.create(repositoryId, cols, rows, target, onEvent);
  }

  write(terminalId: TerminalId, data: string): Promise<void> {
    return this.#api.write(terminalId, data);
  }

  resize(terminalId: TerminalId, cols: number, rows: number): Promise<void> {
    return this.#api.resize(terminalId, cols, rows);
  }

  close(terminalId: TerminalId): Promise<void> {
    return this.#api.close(terminalId);
  }

  closeRepository(repositoryId: RepositoryId): Promise<void> {
    return this.#api.closeRepository(repositoryId);
  }
}
