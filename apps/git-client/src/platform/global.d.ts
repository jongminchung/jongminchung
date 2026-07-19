import type { DesktopApi } from "../shared/contracts/ipc";

declare global {
  interface Window {
    readonly gitClient?: DesktopApi;
  }
}

export {};
