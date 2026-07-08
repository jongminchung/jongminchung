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
  shouldRetryAutoCaptionTranslation,
  type AutoCaptionStatusLike,
} from "../lib/video-auto-activation";

type AutoCaptionControlType = Extract<
  ActiveTabTranslationControlRequest["type"],
  "status" | "run-caption-translation"
>;

const VIDEO_CONTEXT_WAIT_ATTEMPTS = 16;
const VIDEO_CONTEXT_WAIT_INTERVAL_MS = 250;
const PLAYER_DATA_SETTLE_DELAY_MS = 900;
const AUTO_CAPTION_RETRY_LIMIT = 3;
const AUTO_CAPTION_RETRY_DELAY_MS = 2_500;
const FLOATING_CONTROL_SELECTOR = '[data-testid="floating-translate-control"]';
const FLOATING_TOOLTIP_SELECTOR = '[data-testid="floating-translate-tooltip"]';
const FLOATING_STATUS_SELECTOR = '[data-testid="floating-translate-status"]';
const AUTO_CAPTION_CONTROL_FAILURE_MESSAGE =
  "영상 자막 자동 시작 실패: 확장 번역 컨트롤이 응답하지 않습니다.";

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

function showAutoCaptionFailure(message: string): void {
  const control = document.querySelector(FLOATING_CONTROL_SELECTOR);
  const tooltip = document.querySelector(FLOATING_TOOLTIP_SELECTOR);
  const status = document.querySelector(FLOATING_STATUS_SELECTOR);
  if (control instanceof HTMLElement) {
    control.dataset.state = "error";
    control.setAttribute("aria-label", "번역 장애");
    Object.assign(control.style, {
      background: "#b42318",
      boxShadow: "0 10px 22px rgba(180, 35, 24, 0.28)",
    });
  }
  if (tooltip instanceof HTMLElement) tooltip.textContent = "번역 장애";
  if (status instanceof HTMLElement) {
    status.textContent = message;
    Object.assign(status.style, {
      display: "",
      border: "1px solid rgba(180, 35, 24, 0.35)",
      background: "#fff1f0",
      color: "#9f1f17",
    });
  }
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
    let lastObservedAutoCaptionUrl = location.href;
    let autoCaptionInFlight = false;
    let autoCaptionRetryTimer: number | null = null;
    const autoCaptionRetryCountsByUrl = new Map<string, number>();

    const clearAutoCaptionRetryTimer = (): void => {
      if (autoCaptionRetryTimer === null) return;
      window.clearTimeout(autoCaptionRetryTimer);
      autoCaptionRetryTimer = null;
    };

    const scheduleAutoCaptionRetry = (
      currentUrl: string,
      failureMessage?: string,
    ): boolean => {
      const retryCount = autoCaptionRetryCountsByUrl.get(currentUrl) ?? 0;
      if (retryCount >= AUTO_CAPTION_RETRY_LIMIT) {
        if (failureMessage) showAutoCaptionFailure(failureMessage);
        return false;
      }
      autoCaptionRetryCountsByUrl.set(currentUrl, retryCount + 1);
      lastAutoCaptionUrl = null;
      clearAutoCaptionRetryTimer();
      autoCaptionRetryTimer = window.setTimeout(() => {
        autoCaptionRetryTimer = null;
        if (location.href === currentUrl) void autoEnableCaptions();
      }, AUTO_CAPTION_RETRY_DELAY_MS);
      return true;
    };

    const resetAutoCaptionForNavigation = (): void => {
      const currentUrl = location.href;
      if (currentUrl !== lastObservedAutoCaptionUrl) {
        autoCaptionRetryCountsByUrl.clear();
        lastObservedAutoCaptionUrl = currentUrl;
      }
      lastAutoCaptionUrl = null;
      clearAutoCaptionRetryTimer();
    };

    async function autoEnableCaptions(): Promise<void> {
      if (autoCaptionInFlight) return;
      autoCaptionInFlight = true;
      try {
        if (!(await waitForVideoContext())) return;
        const currentUrl = location.href;
        if (lastAutoCaptionUrl === currentUrl) return;
        if (!(await waitForPlayerDataToSettle(currentUrl))) return;
        if (lastAutoCaptionUrl === currentUrl) return;
        let status: unknown;
        try {
          status = await sendControlMessage("status");
        } catch {
          scheduleAutoCaptionRetry(currentUrl, AUTO_CAPTION_CONTROL_FAILURE_MESSAGE);
          return;
        }
        if (!isTranslationStatusLike(status)) {
          scheduleAutoCaptionRetry(currentUrl, AUTO_CAPTION_CONTROL_FAILURE_MESSAGE);
          return;
        }
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
        try {
          const runStatus = await sendControlMessage("run-caption-translation");
          if (!isTranslationStatusLike(runStatus) || shouldRetryAutoCaptionTranslation(runStatus)) {
            scheduleAutoCaptionRetry(currentUrl);
          }
        } catch {
          scheduleAutoCaptionRetry(currentUrl, AUTO_CAPTION_CONTROL_FAILURE_MESSAGE);
        }
      } finally {
        autoCaptionInFlight = false;
      }
    }

    void autoEnableCaptions();
    window.addEventListener("yt-navigate-finish", () => {
      resetAutoCaptionForNavigation();
      void autoEnableCaptions();
    });
    window.addEventListener("yt-player-updated", () => {
      resetAutoCaptionForNavigation();
      void autoEnableCaptions();
    });
    window.addEventListener("yt-page-data-updated", () => {
      resetAutoCaptionForNavigation();
      void autoEnableCaptions();
    });
  },
});
