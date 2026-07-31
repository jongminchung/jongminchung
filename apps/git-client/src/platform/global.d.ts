import type { DesktopApi } from "../shared/contracts/ipc";
import type { LocalHistoryApi } from "../shared/contracts/local-history-ipc";

declare global {
  interface Window {
    readonly gitClient?: DesktopApi;
    readonly gitClientLocalHistory?: LocalHistoryApi;
  }
}

export {};
