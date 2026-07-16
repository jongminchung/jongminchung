import { Channel, invoke } from "@tauri-apps/api/core";
import type { RepositoryId, TerminalEvent, TerminalId } from "../generated";

export interface TerminalBridge {
  create(
    repositoryId: RepositoryId,
    cols: number,
    rows: number,
    onEvent: (event: TerminalEvent) => void,
  ): Promise<TerminalId>;
  write(terminalId: TerminalId, data: string): Promise<void>;
  resize(terminalId: TerminalId, cols: number, rows: number): Promise<void>;
  close(terminalId: TerminalId): Promise<void>;
  closeRepository(repositoryId: RepositoryId): Promise<void>;
}

export class TauriTerminalBridge implements TerminalBridge {
  create(
    repositoryId: RepositoryId,
    cols: number,
    rows: number,
    onEvent: (event: TerminalEvent) => void,
  ): Promise<TerminalId> {
    const channel = new Channel<TerminalEvent>();
    channel.onmessage = onEvent;
    return invoke("create_terminal", { repositoryId, cols, rows, onEvent: channel });
  }

  write(terminalId: TerminalId, data: string): Promise<void> {
    return invoke("write_terminal", { terminalId, data });
  }

  resize(terminalId: TerminalId, cols: number, rows: number): Promise<void> {
    return invoke("resize_terminal", { terminalId, cols, rows });
  }

  close(terminalId: TerminalId): Promise<void> {
    return invoke("close_terminal", { terminalId });
  }

  closeRepository(repositoryId: RepositoryId): Promise<void> {
    return invoke("close_repository_terminals", { repositoryId });
  }
}
