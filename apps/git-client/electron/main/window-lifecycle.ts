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
