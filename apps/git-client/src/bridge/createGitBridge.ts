import { electronApi } from "../platform/electron";
import type { DesktopApi } from "../shared/contracts/ipc";
import { ElectronGitBridge, type ElectronGitApi } from "./ElectronGitBridge";
import type { GitBridge } from "./GitBridge";

function hasGitApi(api: DesktopApi): api is DesktopApi & { readonly git: ElectronGitApi } {
  return "git" in api;
}

export function createGitBridge(): GitBridge {
  const api = electronApi();
  if (api !== null && hasGitApi(api)) return new ElectronGitBridge(api.git);
  const unavailable = new Proxy(Object.create(null) as Record<PropertyKey, unknown>, {
    get: (_target, property) => {
      if (typeof property !== "string") return undefined;
      return (): Promise<never> =>
        Promise.reject(new Error(`${property} is available in the Electron app.`));
    },
  });
  return unavailable as unknown as GitBridge;
}
