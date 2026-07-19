import type { RepositoryId, TerminalEvent, TerminalId } from "../generated";
import type {
  TerminalLaunchTarget,
  TerminalLaunchTargets,
} from "../shared/contracts/terminal";

export interface TerminalBridge {
  listLaunchTargets(): Promise<TerminalLaunchTargets>;
  create(
    repositoryId: RepositoryId,
    cols: number,
    rows: number,
    target: TerminalLaunchTarget,
    onEvent: (event: TerminalEvent) => void,
  ): Promise<TerminalId>;
  write(terminalId: TerminalId, data: string): Promise<void>;
  resize(terminalId: TerminalId, cols: number, rows: number): Promise<void>;
  close(terminalId: TerminalId): Promise<void>;
  closeRepository(repositoryId: RepositoryId): Promise<void>;
}
