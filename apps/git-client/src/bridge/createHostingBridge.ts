import { electronApi } from "../platform/electron";
import { ElectronHostingBridge } from "./ElectronHostingBridge";
import type { HostingBridge } from "./HostingBridge";

export function createHostingBridge(): HostingBridge {
    const api = electronApi();
    if (api !== null) return ElectronHostingBridge.of(api.hosting);
    throw new Error("Git Client requires the Electron desktop bridge.");
}
