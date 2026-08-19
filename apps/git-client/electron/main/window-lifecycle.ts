import type { WindowPresentationMode } from "../../src/shared/contracts/ipc";

export const WELCOME_TRAFFIC_LIGHT_POSITION = { x: 14, y: 7 } as const;

export function shouldRequestProjectClose(
    mode: WindowPresentationMode,
    quitting: boolean,
): boolean {
    return mode === "workspace" && !quitting;
}

export function shouldQuitAfterLastWindow(platform: NodeJS.Platform): boolean {
    return platform !== "darwin";
}

export function shouldCreateWindowOnActivate(windowCount: number): boolean {
    return windowCount === 0;
}

export function secondInstanceAction(): "focus-existing-window" {
    // External argv is intentionally outside this decision until a validated
    // application-command schema and an explicit product requirement exist.
    return "focus-existing-window";
}
