import type { DesktopApi } from "../shared/contracts/ipc";

export function electronApi(): DesktopApi | null {
    if (typeof window === "undefined") return null;
    return window.gitClient ?? null;
}

export function isElectronRuntime(): boolean {
    return electronApi() !== null;
}

export function isNativeRuntime(): boolean {
    return isElectronRuntime();
}
