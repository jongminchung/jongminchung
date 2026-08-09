import { repositoryAccessPolicy, type RepositoryAccessPolicy } from "../domain/repositoryAccess";
import { electronApi } from "../platform/electron";
import { ElectronHostingBridge } from "./ElectronHostingBridge";
import type { HostingBridge } from "./HostingBridge";

export function createHostingBridge(
  access: RepositoryAccessPolicy = repositoryAccessPolicy,
): HostingBridge {
  const api = electronApi();
  if (api !== null) return ElectronHostingBridge.of(api.hosting, access);
  throw new Error("Git Client requires the Electron desktop bridge.");
}
