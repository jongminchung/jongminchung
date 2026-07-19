import type { DesktopApi } from "../shared/contracts/ipc";
import { electronApi } from "../platform/electron";
import { ElectronGitBridge, type ElectronGitApi } from "./ElectronGitBridge";
import type { GitBridge } from "./GitBridge";

function hasGitApi(api: DesktopApi): api is DesktopApi & { readonly git: ElectronGitApi } {
    return "git" in api;
}

export function createGitBridge(): GitBridge {
    const api = electronApi();
    if (api !== null && hasGitApi(api)) return new ElectronGitBridge(api.git);
    throw new Error("Git Client requires the Electron desktop bridge.");
}
