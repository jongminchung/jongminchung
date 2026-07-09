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
  "status" | "run-caption-translation" | "run-webpage-translation"
>;

const VIDEO_CONTEXT_WAIT_ATTEMPTS = 16;
const VIDEO_CONTEXT_WAIT_INTERVAL_MS = 250;
const PLAYER_DATA_SETTLE_DELAY_MS = 900;
const AUTO_CAPTION_RETRY_LIMIT = 3;
const AUTO_CAPTION_RETRY_DELAY_MS = 2_500;
const AUTO_WEBPAGE_NAVIGATION_DELAYS_MS = [250, 1_500] as const;
const AUTO_WEBPAGE_RETRY_LIMIT = 2;
const WEBPAGE_URL_POLL_INTERVAL_MS = 500;
const FLOATING_CONTROL_SELECTOR = '[data-testid="floating-translate-control"]';
const FLOATING_ACTIVE_INDICATOR_SELECTOR = '[data-testid="floating-translate-active-indicator"]';
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

function isWebpageSessionStatusLike(value: unknown): value is {
  readonly webpageTranslationSessionActive: boolean;
  readonly webpageState: { readonly name: string };
} {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  if (typeof record.webpageTranslationSessionActive !== "boolean") return false;
  const webpageState = record.webpageState;
  if (typeof webpageState !== "object" || webpageState === null) return false;
  return typeof (webpageState as Record<string, unknown>).name === "string";
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

function isVideoTranslationPage(): boolean {
  return (
    location.hostname === "www.youtube.com" ||
    location.hostname === "youtube.com" ||
    location.hostname === "m.youtube.com" ||
    location.hostname.endsWith("udemy.com") ||
    document.querySelector("video") !== null ||
    /youtube|caption|subtitle|video|udemy/i.test(`${location.hostname} ${location.pathname}`)
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
  const activeIndicator = document.querySelector(FLOATING_ACTIVE_INDICATOR_SELECTOR);
  if (control instanceof HTMLElement) {
    control.dataset.state = "error";
    control.setAttribute("aria-label", "번역 장애");
    Object.assign(control.style, {
      background: "#b42318",
      boxShadow: "0 10px 22px rgba(180, 35, 24, 0.28)",
    });
  }
  activeIndicator?.remove();
  const hiddenStatus = document.querySelector("#tab-shelf-translation-bridge-status");
  if (hiddenStatus instanceof HTMLElement) hiddenStatus.textContent = message;
}

function hasRenderedWebpageTranslation(): boolean {
  return document.querySelector('[data-tab-shelf-webpage-translation="true"]') !== null;
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
    let lastObservedWebpageUrl = location.href;
    let lastAutoWebpageUrl: string | null = null;
    let autoWebpageInFlight = false;
    let autoCaptionInFlight = false;
    let autoCaptionRetryTimer: number | null = null;
    const autoCaptionRetryCountsByUrl = new Map<string, number>();
    const autoWebpageRetryCountsByUrl = new Map<string, number>();

    const clearAutoCaptionRetryTimer = (): void => {
      if (autoCaptionRetryTimer === null) return;
      window.clearTimeout(autoCaptionRetryTimer);
      autoCaptionRetryTimer = null;
    };

    const scheduleAutoCaptionRetry = (currentUrl: string, failureMessage?: string): boolean => {
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

    function queueAutoWebpageTranslation(delayMs: number): void {
      window.setTimeout(() => {
        void autoEnableWebpageTranslation();
      }, delayMs);
    }

    function detectWebpageNavigation(): void {
      const currentUrl = location.href;
      if (currentUrl === lastObservedWebpageUrl) return;
      lastObservedWebpageUrl = currentUrl;
      lastAutoWebpageUrl = null;
      autoWebpageRetryCountsByUrl.delete(currentUrl);
      for (const delayMs of AUTO_WEBPAGE_NAVIGATION_DELAYS_MS) {
        queueAutoWebpageTranslation(delayMs);
      }
    }

    async function autoEnableWebpageTranslation(): Promise<void> {
      if (autoWebpageInFlight) return;
      if (isVideoTranslationPage()) return;
      autoWebpageInFlight = true;
      try {
        const status = await sendControlMessage("status");
        if (!isWebpageSessionStatusLike(status)) return;
        if (!status.webpageTranslationSessionActive) return;
        if (
          status.webpageState.name === "collecting" ||
          status.webpageState.name === "translating"
        ) {
          return;
        }
        const currentUrl = location.href;
        if (currentUrl === lastAutoWebpageUrl && hasRenderedWebpageTranslation()) return;
        const retryCount = autoWebpageRetryCountsByUrl.get(currentUrl) ?? 0;
        if (currentUrl === lastAutoWebpageUrl && retryCount > AUTO_WEBPAGE_RETRY_LIMIT) return;
        lastAutoWebpageUrl = currentUrl;
        autoWebpageRetryCountsByUrl.set(currentUrl, retryCount + 1);
        await sendControlMessage("run-webpage-translation");
      } catch {
        return;
      } finally {
        autoWebpageInFlight = false;
      }
    }

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

    void autoEnableWebpageTranslation();
    void autoEnableCaptions();
    window.setInterval(detectWebpageNavigation, WEBPAGE_URL_POLL_INTERVAL_MS);
    window.addEventListener("popstate", detectWebpageNavigation);
    window.addEventListener("hashchange", detectWebpageNavigation);
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
