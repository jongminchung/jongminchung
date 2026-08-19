import { BrowserWindow } from "electron";
import type { IpcMainEvent, IpcMainInvokeEvent } from "electron";
import type { RepositoryId } from "../../src/shared/contracts/git-utility";
import {
    isTrustedRendererNavigation,
    isTrustedRendererRoute,
} from "./window-security";

export function assertTrustedSender(
    event: IpcMainEvent | IpcMainInvokeEvent,
    window: BrowserWindow,
    developmentServerUrl?: string,
): void {
    if (event.sender !== window.webContents) {
        throw new Error("IPC sender is not the main window.");
    }
    if (event.senderFrame !== window.webContents.mainFrame) {
        throw new Error("IPC sender is not the main frame.");
    }
    const frameUrl = event.senderFrame?.url ?? "";
    if (!isTrustedRendererNavigation(frameUrl, developmentServerUrl))
        throw new Error("IPC sender origin is not trusted.");
}

export function assertTrustedLocalHistorySender(
    event: IpcMainInvokeEvent,
    window: BrowserWindow,
    repositoryId: RepositoryId | null,
    developmentServerUrl?: string,
): asserts repositoryId is RepositoryId {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (
        repositoryId === null ||
        senderWindow === null ||
        senderWindow.getParentWindow() !== window
    ) {
        throw new Error(
            "IPC sender is not an authorized Local History window.",
        );
    }
    if (event.senderFrame !== senderWindow.webContents.mainFrame) {
        throw new Error("IPC sender is not the Local History main frame.");
    }
    if (
        !isTrustedRendererRoute(
            event.senderFrame.url,
            developmentServerUrl,
            "/local-history",
        )
    ) {
        throw new Error(
            "IPC sender origin is not a trusted Local History route.",
        );
    }
}
