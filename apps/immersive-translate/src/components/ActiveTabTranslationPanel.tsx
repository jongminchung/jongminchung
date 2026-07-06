import type { JSX } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { browser } from "wxt/browser";
import {
  ACTIVE_TAB_TRANSLATION_CONTROL_SCOPE,
  type ActiveTabTranslationStatus,
} from "../lib/active-tab-translation";
import { LocalTranslationRepository } from "../lib/local-translation";

const localTranslationRepository = LocalTranslationRepository.ofStorage(browser.storage.local);

interface ProgressLike {
  readonly total: number;
  readonly completed: number;
  readonly cacheHits: number;
  readonly failures: number;
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
  if (status.localTranslationState === "disabled") return "번역 provider가 꺼져 있습니다.";
  return "오른쪽의 클릭 번역 버튼을 사용할 수 있습니다.";
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

export function ActiveTabTranslationPanel(): JSX.Element {
  const [status, setStatus] = useState<ActiveTabTranslationStatus | null>(null);
  const [providerReady, setProviderReady] = useState<boolean | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  const refreshStatus = useCallback(async (): Promise<void> => {
    try {
      setStatusError(null);
      setProviderReady((await localTranslationRepository.load()).enabled);
      setStatus(await readStatus());
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "상태를 읽을 수 없습니다.");
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
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
      void refreshStatus();
    }, 500);
    return () => window.clearInterval(intervalId);
  }, [refreshStatus, status?.captionState.name, status?.webpageState.name]);

  const providerLabel = useMemo(() => {
    if (providerReady === null) return "Default Docker 확인 중";
    return providerReady ? "Default Docker 켜짐" : "Default Docker 꺼짐";
  }, [providerReady]);
  const pageProgress = progressLabel(status?.webpageState.progress);
  const captionProgress = progressLabel(status?.captionState.progress);

  return (
    <section className="w-[360px] max-w-full p-3 text-[inherit]">
      <div className="surface-elevated rounded-lg p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-(--muted-foreground)">
              Tobi Immersive Translate
            </div>
            <h1 className="mt-2 text-lg font-semibold tracking-normal">
              오른쪽 번역 버튼을 사용하세요
            </h1>
          </div>
          <span
            data-testid="popup-provider-status"
            className={cx(
              "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold",
              providerReady
                ? "border-(--primary) bg-(--secondary) text-(--secondary-foreground)"
                : "border-(--border) text-(--muted-foreground)",
            )}
          >
            {providerLabel}
          </span>
        </div>

        <div
          data-testid="popup-floating-toggle-guidance"
          className="mt-4 rounded-lg border border-(--border) bg-(--card) p-3 text-sm leading-6"
        >
          페이지 오른쪽의 <strong>클릭 번역</strong> 버튼을 누르면 본문 번역이 시작됩니다. 영상
          페이지는 열리면 자막 번역을 자동으로 시도합니다.
        </div>

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

        {(status?.lastError || statusError) && (
          <div className="mt-3 rounded-md border border-(--destructive) bg-(--card) px-3 py-2 text-xs text-(--destructive)">
            {status?.lastError ?? statusError}
          </div>
        )}

        <button
          type="button"
          onClick={() => void refreshStatus()}
          className="mt-3 h-9 w-full rounded-md border border-(--border) bg-(--card) px-3 text-xs font-semibold text-(--muted-foreground)"
        >
          상태 새로고침
        </button>
      </div>
    </section>
  );
}
