import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { StatusDot, type StatusDotVariant } from "@astryxdesign/core/StatusDot";
import { Heading, Text } from "@astryxdesign/core/Text";
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
import { RefreshIcon } from "./TranslationIcons";

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

function readinessVariant(status: TranslationReadinessStatus | null): StatusDotVariant {
  if (status?.state === "ready") return "success";
  if (status?.state === "failed") return "error";
  if (status?.state === "disabled") return "neutral";
  return "accent";
}

function isReadinessPending(status: TranslationReadinessStatus | null): boolean {
  return status === null || status.state === "checking";
}

function progressValueLabel(value: number, max: number): string {
  return `${value}/${max}`;
}

function TranslationProgress({
  label,
  progress,
}: {
  readonly label: string;
  readonly progress: ProgressLike | null | undefined;
}) {
  if (!progress || progress.total === 0) return null;
  return (
    <div className="mt-3 grid gap-1.5">
      <ProgressBar
        label={label}
        value={progress.completed}
        max={progress.total}
        hasValueLabel
        formatValueLabel={progressValueLabel}
        variant={progress.failures > 0 ? "warning" : "accent"}
      />
      <Text type="supporting" display="block">
        캐시 {progress.cacheHits} · 실패 {progress.failures}
      </Text>
    </div>
  );
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
      const [nextStatus, nextReadinessStatus] = await Promise.all([
        readStatus(),
        checkTranslationReadiness(settings),
      ]);
      setStatus(nextStatus);
      setReadinessStatus(nextReadinessStatus);
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
  const errorMessage =
    translationReadinessDetail(readinessStatus) ??
    userVisibleTranslationErrorMessage(status?.lastError ?? statusError);

  return (
    <section className="w-[360px] max-w-full bg-body p-3 text-primary">
      <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Text type="supporting" display="block">
              Tobi Immersive Translate
            </Text>
            <Heading level={1} className="mt-1.5">
              페이지 번역
            </Heading>
          </div>
          <div
            className="flex shrink-0 items-center gap-2 pt-1"
            data-testid="popup-translation-status"
          >
            <StatusDot
              variant={readinessVariant(readinessStatus)}
              label={readinessLabel}
              isPulsing={isReadinessPending(readinessStatus)}
              tooltip={readinessLabel}
            />
            <Text type="supporting">{readinessLabel}</Text>
          </div>
        </header>

        <div
          data-testid="popup-floating-toggle-guidance"
          className="mt-4 border-y border-border py-3"
        >
          <Text type="body" display="block">
            페이지에서는 오른쪽 번역 버튼으로 본문을 번역합니다. 영상 페이지는 자막 번역을 자동으로
            시도합니다.
          </Text>
        </div>

        {errorMessage ? (
          <div className="mt-3">
            <Banner status="error" title="번역 연결을 확인하세요" description={errorMessage} />
          </div>
        ) : null}

        <section data-testid="popup-current-page-status" className="border-b border-border py-4">
          <Text type="label" display="block">
            현재 페이지
          </Text>
          <Text type="body" weight="semibold" display="block" maxLines={1} className="mt-1.5">
            {status?.tabTitle || pageStatusLabel(status)}
          </Text>
          {status?.tabUrl ? (
            <Text type="supporting" display="block" maxLines={1} className="mt-1">
              {status.tabUrl}
            </Text>
          ) : null}
          <Text type="supporting" display="block" className="mt-2">
            {pageStatusLabel(status)}
          </Text>
          <TranslationProgress
            label="페이지 번역 진행률"
            progress={status?.webpageState.progress}
          />
        </section>

        <section className="py-4">
          <Text type="label" display="block">
            영상 자막
          </Text>
          <Text type="supporting" display="block" className="mt-2">
            {captionStatusLabel(status)}
          </Text>
          <TranslationProgress label="자막 번역 진행률" progress={status?.captionState.progress} />
        </section>

        <Button
          label="상태 새로고침"
          variant="secondary"
          size="lg"
          className="w-full"
          icon={<Icon icon={RefreshIcon} size="sm" />}
          clickAction={() => refreshStatus({ checkEndpoint: true })}
        />
      </div>
    </section>
  );
}
