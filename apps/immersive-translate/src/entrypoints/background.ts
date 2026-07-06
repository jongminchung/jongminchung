import { browser } from "wxt/browser";
import { defineBackground } from "wxt/utils/define-background";
import {
  isTrustedContentSender,
  isTrustedControlSender,
  parseControlRequest,
} from "../lib/active-tab-translation";
import {
  buildFailureStatus,
  clearTabState,
  handleControlRequest,
} from "../lib/active-tab-translation-controller";

interface ContentScriptChromeApi {
  readonly runtime: {
    readonly id?: string;
    readonly onMessage: {
      readonly addListener: (
        listener: (
          message: unknown,
          sender: {
            readonly id?: string;
            readonly url?: string;
            readonly tab?: {
              readonly id?: number;
            };
          },
          sendResponse: (response: unknown) => void,
        ) => boolean,
      ) => void;
    };
  };
}

export default defineBackground(() => {
  const runtimeChrome = (globalThis as typeof globalThis & { chrome: ContentScriptChromeApi })
    .chrome;

  runtimeChrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const request = parseControlRequest(message);
    const extensionId = runtimeChrome.runtime.id ?? browser.runtime.id;
    const trustedPopup = isTrustedControlSender(sender, extensionId);
    const trustedContent = isTrustedContentSender(sender, extensionId);
    if (!request || (!trustedPopup && !trustedContent)) return false;
    void handleControlRequest(request, { tabId: sender.tab?.id })
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse(buildFailureStatus(error));
      });
    return true;
  });

  browser.tabs.onRemoved.addListener((tabId) => {
    clearTabState(tabId);
  });

  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (!changeInfo.url) return;
    clearTabState(tabId);
  });
});
