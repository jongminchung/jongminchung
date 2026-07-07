import { browser } from "wxt/browser";
import { defineContentScript } from "wxt/utils/define-content-script";
import {
  ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE,
  ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
  type ActiveTabTranslationControlRequest,
} from "../lib/active-tab-translation";
import { installTranslationBridgeInPage } from "../lib/injected-translation-bridge";
import {
  shouldAutoStartCaptionTranslation,
  type AutoCaptionStatusLike,
} from "../lib/video-auto-activation";

type AutoCaptionControlType = Extract<
  ActiveTabTranslationControlRequest["type"],
  "status" | "run-caption-translation"
>;

const VIDEO_CONTEXT_WAIT_ATTEMPTS = 16;
const VIDEO_CONTEXT_WAIT_INTERVAL_MS = 250;
const PLAYER_DATA_SETTLE_DELAY_MS = 900;

function isTranslationStatusLike(value: unknown): value is AutoCaptionStatusLike {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (record.localTranslationState !== "enabled" && record.localTranslationState !== "disabled") {
    return false;
  }
  const captionState = record.captionState;
  if (typeof captionState !== "object" || captionState === null) return false;
  return typeof (captionState as Record<string, unknown>).name === "string";
}

async function sendControlMessage(type: AutoCaptionControlType): Promise<unknown> {
  return browser.runtime.sendMessage({
    scope: ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE,
    type,
  });
}

function hasVideoContext(): boolean {
  return Boolean(
    document.querySelector("video, #movie_player, .html5-video-player") ||
    /youtube|watch|caption|subtitle|video/i.test(`${location.hostname} ${location.pathname}`),
  );
}

async function waitForVideoContext(): Promise<boolean> {
  for (let attempt = 0; attempt < VIDEO_CONTEXT_WAIT_ATTEMPTS; attempt += 1) {
    if (hasVideoContext()) return true;
    await new Promise((resolve) => window.setTimeout(resolve, VIDEO_CONTEXT_WAIT_INTERVAL_MS));
  }
  return false;
}

async function waitForPlayerDataToSettle(currentUrl: string): Promise<boolean> {
  await new Promise((resolve) => window.setTimeout(resolve, PLAYER_DATA_SETTLE_DELAY_MS));
  return location.href === currentUrl;
}

export default defineContentScript({
  matches: ["http://*/*", "https://*/*"],
  runAt: "document_idle",
  main(): void {
    installTranslationBridgeInPage(
      ACTIVE_TAB_TRANSLATION_PAGE_SCOPE,
      ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE,
    );

    let lastAutoCaptionUrl: string | null = null;
    let autoCaptionInFlight = false;

    const autoEnableCaptions = async (): Promise<void> => {
      if (autoCaptionInFlight) return;
      autoCaptionInFlight = true;
      try {
        if (!(await waitForVideoContext())) return;
        const currentUrl = location.href;
        if (lastAutoCaptionUrl === currentUrl) return;
        if (!(await waitForPlayerDataToSettle(currentUrl))) return;
        if (lastAutoCaptionUrl === currentUrl) return;
        const status = await sendControlMessage("status");
        if (!isTranslationStatusLike(status)) return;
        if (
          !shouldAutoStartCaptionTranslation({
            status,
            currentUrl,
            lastAutoCaptionUrl,
            hasVideoContext: true,
          })
        ) {
          return;
        }
        lastAutoCaptionUrl = currentUrl;
        await sendControlMessage("run-caption-translation");
      } finally {
        autoCaptionInFlight = false;
      }
    };

    void autoEnableCaptions();
    window.addEventListener("yt-navigate-finish", () => {
      lastAutoCaptionUrl = null;
      void autoEnableCaptions();
    });
    window.addEventListener("yt-player-updated", () => {
      lastAutoCaptionUrl = null;
      void autoEnableCaptions();
    });
    window.addEventListener("yt-page-data-updated", () => {
      lastAutoCaptionUrl = null;
      void autoEnableCaptions();
    });
  },
});
