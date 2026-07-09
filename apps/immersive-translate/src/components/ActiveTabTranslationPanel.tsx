import type { JSX } from "react";
import { useCallback, useEffect, useState } from "react";
import { browser } from "wxt/browser";
import {
  ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE,
  type ActiveTabTranslationStatus,
} from "../lib/active-tab-translation";
import {
  LocalTranslationRepository,
  LocalTranslationService,
  type LocalTranslationFetch,
  type LocalTranslationSettings,
} from "../lib/local-translation";
import {
  checkingTranslationReadinessStatus,
  disabledTranslationReadinessStatus,
  translationReadinessDetail,
  translationReadinessLabel,
  translationReadinessStatusFromSelfTest,
  type TranslationReadinessStatus,
  userVisibleTranslationErrorMessage,
} from "../lib/translation-readiness";

const localTranslationRepository = LocalTranslationRepository.ofStorage(browser.storage.local);
const TRANSLATION_READINESS_TIMEOUT_MS = 10_000;

interface ProgressLike {
  readonly total: number;
  readonly completed: number;
  readonly cacheHits: number;
  readonly failures: number;
}

interface RefreshStatusOptions {
  readonly checkEndpoint: boolean;
}

function cx(...values: readonly (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

function pageStatusLabel(status: ActiveTabTranslationStatus | null): string {
  if (!status) return "현재 페이지를 확인하는 중입니다.";
  if (!status.pageSupported) return status.unsupportedReason ?? "이 페이지는 번역할 수 없습니다.";
  if (status.webpageState.name === "rendered") return "현재 페이지 번역이 표시되어 있습니다.";
  if (status.webpageState.name === "translating") return "현재 페이지를 번역하는 중입니다.";
  if (status.webpageState.name === "collecting") return "번역할 본문을 수집하는 중입니다.";
  if (status.webpageState.name === "failed") return "현재 페이지 번역에 실패했습니다.";
  if (status.localTranslationState === "disabled") return "번역이 꺼져 있습니다.";
  return "오른쪽 번역 버튼을 사용할 수 있습니다.";
}

function captionStatusLabel(status: ActiveTabTranslationStatus | null): string {
  if (!status) return "영상 자막 상태를 확인하는 중입니다.";
  if (status.captionState.name === "rendered")
    return "영상 자막 번역이 자동으로 표시되어 있습니다.";
  if (status.captionState.name === "translating") return "영상 자막을 번역하는 중입니다.";
  if (status.captionState.name === "detecting") return "영상 자막을 찾는 중입니다.";
  if (status.captionState.name === "failed") return "영상 자막 번역에 실패했습니다.";
  if (status.captionState.name === "no-captions") return "감지된 영상 자막이 없습니다.";
  return "영상 페이지에서는 자막 번역을 자동으로 시도합니다.";
}

function progressLabel(progress: ProgressLike | null | undefined): string | null {
  if (!progress || progress.total === 0) return null;
  return `${progress.completed}/${progress.total} 처리됨 · 캐시 ${progress.cacheHits} · 실패 ${progress.failures}`;
}

async function readStatus(): Promise<ActiveTabTranslationStatus> {
  return browser.runtime.sendMessage({
    scope: ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE,
    type: "status",
  });
}

const fetchWithTimeout: LocalTranslationFetch = async (
  input: string,
  init: RequestInit,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort();
  }, TRANSLATION_READINESS_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
};

async function checkTranslationReadiness(
  settings: LocalTranslationSettings,
): Promise<TranslationReadinessStatus> {
  if (!settings.enabled) return disabledTranslationReadinessStatus(settings);
  const result = await LocalTranslationService.selfTest(settings, fetchWithTimeout);
  return translationReadinessStatusFromSelfTest(settings, result);
}

export function ActiveTabTranslationPanel(): JSX.Element {
  const [status, setStatus] = useState<ActiveTabTranslationStatus | null>(null);
  const [readinessStatus, setReadinessStatus] = useState<TranslationReadinessStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const refreshStatus = useCallback(async (options: RefreshStatusOptions): Promise<void> => {
    try {
      setStatusError(null);
      const settings = await localTranslationRepository.load();
      if (!settings.enabled) {
        setReadinessStatus(disabledTranslationReadinessStatus(settings));
        setStatus(await readStatus());
        return;
      }

      if (!options.checkEndpoint) {
        setStatus(await readStatus());
        return;
      }

      setReadinessStatus(checkingTranslationReadinessStatus(settings));
      const nextStatusPromise = readStatus();
      const nextReadinessStatusPromise = checkTranslationReadiness(settings);
      setStatus(await nextStatusPromise);
      setReadinessStatus(await nextReadinessStatusPromise);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "상태를 읽을 수 없습니다.");
    }
  }, []);

  useEffect(() => {
    void refreshStatus({ checkEndpoint: true });
  }, [refreshStatus]);

  useEffect(() => {
    const pageState = status?.webpageState.name;
    const captionState = status?.captionState.name;
    if (
      pageState !== "collecting" &&
      pageState !== "translating" &&
      captionState !== "detecting" &&
      captionState !== "translating"
    ) {
      return;
    }
    const intervalId = window.setInterval(() => {
      void refreshStatus({ checkEndpoint: false });
    }, 500);
    return () => window.clearInterval(intervalId);
  }, [refreshStatus, status?.captionState.name, status?.webpageState.name]);

  const readinessLabel = translationReadinessLabel(readinessStatus);
  const readinessError = translationReadinessDetail(readinessStatus);
  const pageProgress = progressLabel(status?.webpageState.progress);
  const captionProgress = progressLabel(status?.captionState.progress);
  const visibleError = userVisibleTranslationErrorMessage(status?.lastError ?? statusError);

  return (
    <section className="w-[360px] max-w-full p-3 text-[inherit]">
      <div className="surface-elevated rounded-lg p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-(--muted-foreground)">
              Tobi Immersive Translate
            </div>
            <h1 className="mt-2 text-lg font-semibold tracking-normal">페이지 번역</h1>
          </div>
          <span
            data-testid="popup-translation-status"
            title={
              readinessStatus?.endpoint
                ? `번역 서버 URL: ${readinessStatus.endpoint}`
                : "번역 연결 상태"
            }
            className={cx(
              "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold",
              readinessStatus?.state === "ready"
                ? "border-(--primary) bg-(--secondary) text-(--secondary-foreground)"
                : readinessStatus?.state === "failed"
                  ? "border-(--destructive) bg-(--card) text-(--destructive)"
                  : "border-(--border) text-(--muted-foreground)",
            )}
          >
            {readinessLabel}
          </span>
        </div>

        <div
          data-testid="popup-floating-toggle-guidance"
          className="mt-4 rounded-lg border border-(--border) bg-(--card) p-3 text-sm leading-6"
        >
          페이지에서는 오른쪽 번역 버튼으로 본문을 번역합니다. 영상 페이지는 자막 번역을 자동으로
          시도합니다.
        </div>

        {readinessError && readinessStatus?.state === "failed" && (
          <div
            data-testid="popup-translation-readiness-error"
            className="mt-3 rounded-md border border-(--destructive) bg-(--card) px-3 py-2 text-xs leading-5 text-(--destructive)"
          >
            <div className="font-semibold">로컬 번역 연결 실패</div>
            <div className="mt-1">{readinessError}</div>
            <div className="mt-1 break-all text-(--muted-foreground)">
              URL: {readinessStatus.endpoint}
            </div>
          </div>
        )}

        <div
          data-testid="popup-current-page-status"
          className="mt-3 rounded-lg border border-(--border) bg-(--card) p-3"
        >
          <div className="text-[10px] uppercase tracking-[0.18em] text-(--muted-foreground)">
            현재 페이지
          </div>
          <div className="mt-1 truncate text-sm font-semibold">
            {status?.tabTitle || pageStatusLabel(status)}
          </div>
          {status?.tabUrl && (
            <div className="mt-1 truncate text-xs text-(--muted-foreground)">{status.tabUrl}</div>
          )}
          <div className="mt-2 text-xs text-(--muted-foreground)">{pageStatusLabel(status)}</div>
          {pageProgress && (
            <div className="mt-2 rounded-md bg-(--secondary) px-2 py-1 text-xs">{pageProgress}</div>
          )}
        </div>

        <div className="mt-3 rounded-lg border border-(--border) bg-(--card) p-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-(--muted-foreground)">
            영상 자막
          </div>
          <div className="mt-2 text-xs text-(--muted-foreground)">{captionStatusLabel(status)}</div>
          {captionProgress && (
            <div className="mt-2 rounded-md bg-(--secondary) px-2 py-1 text-xs">
              {captionProgress}
            </div>
          )}
        </div>

        {visibleError && (
          <div className="mt-3 rounded-md border border-(--destructive) bg-(--card) px-3 py-2 text-xs text-(--destructive)">
            {visibleError}
          </div>
        )}

        <button
          type="button"
          onClick={() => void refreshStatus({ checkEndpoint: true })}
          className="mt-3 h-9 w-full rounded-md border border-(--border) bg-(--card) px-3 text-xs font-semibold text-(--muted-foreground)"
        >
          상태 새로고침
        </button>
      </div>
    </section>
  );
}
