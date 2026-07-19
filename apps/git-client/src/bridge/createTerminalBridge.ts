import { electronApi } from "../platform/electron";
import { ElectronTerminalBridge } from "./ElectronTerminalBridge";
import type { TerminalBridge } from "./TerminalBridge";

export function createTerminalBridge(): TerminalBridge {
  const api = electronApi();
  if (api !== null) return ElectronTerminalBridge.of(api.terminal);
  throw new Error("Git Client requires the Electron desktop bridge.");
}
