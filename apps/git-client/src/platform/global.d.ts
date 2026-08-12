import type { DesktopApi } from "../shared/contracts/desktop-api";
import type { LocalHistoryApi } from "../shared/contracts/local-history-ipc";

declare global {
    interface Window {
        readonly gitClient?: DesktopApi;
        readonly gitClientLocalHistory?: LocalHistoryApi;
    }
}

export {};
