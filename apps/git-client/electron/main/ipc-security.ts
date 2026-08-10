import { BrowserWindow } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import type { RepositoryId } from "../../src/shared/contracts/git-utility";

export function assertTrustedSender(event: IpcMainInvokeEvent, window: BrowserWindow): void {
  if (event.sender !== window.webContents) {
    throw new Error("IPC sender is not the main window.");
  }
  if (event.senderFrame !== window.webContents.mainFrame) {
    throw new Error("IPC sender is not the main frame.");
  }
  const frameUrl = event.senderFrame?.url ?? "";
  const isProduction = frameUrl.startsWith("app://git-client/");
  const isDevelopment = /^http:\/\/(127\.0\.0\.1|localhost):\d+\//u.test(frameUrl);
  if (!isProduction && !isDevelopment) throw new Error("IPC sender origin is not trusted.");
}

export function assertTrustedLocalHistorySender(
  event: IpcMainInvokeEvent,
  window: BrowserWindow,
  repositoryId: RepositoryId | null,
): asserts repositoryId is RepositoryId {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (repositoryId === null || senderWindow === null || senderWindow.getParentWindow() !== window) {
    throw new Error("IPC sender is not an authorized Local History window.");
  }
  if (event.senderFrame !== senderWindow.webContents.mainFrame) {
    throw new Error("IPC sender is not the Local History main frame.");
  }
  try {
    const frameUrl = new URL(event.senderFrame.url);
    const isProduction =
      frameUrl.protocol === "app:" &&
      frameUrl.host === "git-client" &&
      frameUrl.pathname === "/local-history";
    const isDevelopment =
      frameUrl.pathname === "/local-history" &&
      /^http:\/\/(127\.0\.0\.1|localhost):\d+$/u.test(frameUrl.origin);
    if (!isProduction && !isDevelopment) throw new Error("untrusted");
  } catch {
    throw new Error("IPC sender origin is not a trusted Local History route.");
  }
}
