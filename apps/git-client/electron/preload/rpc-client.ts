import { ipcRenderer } from "electron";
import {
  DesktopRpcRequestSchema,
  desktopRpcChannel,
  type DesktopRpcProcedure,
} from "../../src/shared/contracts/desktop-rpc";

export async function invokeDesktopRpc(
  procedure: DesktopRpcProcedure,
  payload?: unknown,
): Promise<unknown> {
  const request = DesktopRpcRequestSchema.parse({ procedure, payload });
  return ipcRenderer.invoke(desktopRpcChannel(procedure), request);
}
