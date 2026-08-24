import type { TerminalLaunchTarget } from "../../../shared/contracts/terminal";

export interface PersistedTerminalSession {
  readonly title: string;
  readonly target: TerminalLaunchTarget;
}

export type PersistedTerminalSessions = Readonly<
  Record<string, readonly PersistedTerminalSession[]>
>;

export interface TerminalSettingsPort {
  read(): Promise<unknown>;
  write(value: PersistedTerminalSessions): Promise<void>;
}
