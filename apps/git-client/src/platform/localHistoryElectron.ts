import type { LocalHistoryApi } from "../shared/contracts/local-history-ipc";

export function localHistoryElectronApi(): LocalHistoryApi | null {
  if (typeof window === "undefined") return null;
  return window.gitClientLocalHistory ?? null;
}
