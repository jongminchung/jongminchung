import type { LocalTranslationSelfTestResult, LocalTranslationSettings } from "./local-translation";

export type TranslationReadinessStatus =
  | {
      readonly state: "checking";
      readonly endpoint: string;
      readonly message: null;
    }
  | {
      readonly state: "disabled";
      readonly endpoint: string;
      readonly message: null;
    }
  | {
      readonly state: "ready";
      readonly endpoint: string;
      readonly message: string;
    }
  | {
      readonly state: "failed";
      readonly endpoint: string;
      readonly message: string;
    };

const INTERNAL_DETAIL_PATTERN =
  /provider|mlx|libretranslate|browser-detectable|caption cues|script|endpoint|스크립트|브라우저/i;

function trimDetail(value: string): string {
  return normalizeWhitespace(value).replace(/\.+$/, "");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeEndpointFailureMessage(message: string): string {
  const normalized = trimDetail(message);
  const statusMatch = /^Endpoint returned (\d+):\s*(.*?)(?:\. Check\b|$)/i.exec(normalized);
  if (statusMatch) {
    const statusCode = statusMatch[1] ?? "";
    const detail = trimDetail(statusMatch[2] ?? "");
    if (/unable to connect|access the url/i.test(detail)) {
      return `로컬 번역 서버가 HTTP ${statusCode} 응답을 반환했습니다: 모델 서버에 연결할 수 없습니다. 로컬 번역 gateway와 모델 서버가 모두 실행 중인지 확인하세요.`;
    }
    return [
      `로컬 번역 서버가 HTTP ${statusCode} 응답을 반환했습니다`,
      detail ? `: ${/[.!?]$/.test(detail) ? detail : `${detail}.`}` : ".",
      " 잘못된 포트나 다른 로컬 서비스에 연결됐을 수 있습니다.",
    ].join("");
  }

  if (/not JSON|translated text|translatedText|response includes/i.test(normalized)) {
    return "로컬 번역 서버가 번역 응답 형식으로 응답하지 않았습니다. 잘못된 포트나 다른 로컬 서비스에 연결됐을 수 있습니다.";
  }

  if (
    /failed to fetch|fetch failed|load failed|network|couldn'?t connect|econnrefused|aborted|timed out|request failed/i.test(
      normalized,
    )
  ) {
    return "로컬 번역 서버에 연결할 수 없습니다. 로컬 번역 gateway 또는 모델 서버가 실행 중인지 확인하세요.";
  }

  if (/valid endpoint|endpoint URL|http:\/\/|https:\/\//i.test(normalized)) {
    return "로컬 번역 서버 URL 설정을 확인하세요.";
  }

  if (INTERNAL_DETAIL_PATTERN.test(normalized)) {
    return "번역 연결 상태를 확인하지 못했습니다. 로컬 번역 gateway 또는 모델 서버가 실행 중인지 확인하세요.";
  }

  return normalized || "로컬 번역 서버 연결 상태를 확인하지 못했습니다.";
}

export function checkingTranslationReadinessStatus(
  settings: LocalTranslationSettings,
): TranslationReadinessStatus {
  return {
    state: "checking",
    endpoint: settings.endpoint,
    message: null,
  };
}

export function disabledTranslationReadinessStatus(
  settings: LocalTranslationSettings,
): TranslationReadinessStatus {
  return {
    state: "disabled",
    endpoint: settings.endpoint,
    message: null,
  };
}

export function translationReadinessStatusFromSelfTest(
  settings: LocalTranslationSettings,
  result: LocalTranslationSelfTestResult,
): TranslationReadinessStatus {
  if (result.ok) {
    return {
      state: "ready",
      endpoint: settings.endpoint,
      message: result.message,
    };
  }
  return {
    state: "failed",
    endpoint: settings.endpoint,
    message: result.message,
  };
}

export function translationReadinessLabel(
  readinessStatus: TranslationReadinessStatus | null,
): string {
  if (readinessStatus === null || readinessStatus.state === "checking") {
    return "번역 연결 확인 중";
  }
  if (readinessStatus.state === "disabled") return "번역 꺼짐";
  if (readinessStatus.state === "failed") return "번역 연결 실패";
  return "로컬 번역 연결됨";
}

export function translationReadinessDetail(
  readinessStatus: TranslationReadinessStatus | null,
): string | null {
  if (readinessStatus?.state !== "failed") return null;
  return normalizeEndpointFailureMessage(readinessStatus.message);
}

export function userVisibleTranslationErrorMessage(
  message: string | null | undefined,
): string | null {
  if (!message) return null;
  const normalized = normalizeWhitespace(message);
  if (/forbidden|failed to fetch|fetch failed|network|econnrefused/i.test(normalized)) {
    return "로컬 번역 서버 요청이 실패했습니다. 팝업 상단의 연결 상태를 확인하세요.";
  }
  if (INTERNAL_DETAIL_PATTERN.test(normalized)) {
    return "번역 연결 상태를 확인하지 못했습니다. 로컬 번역 gateway 또는 모델 서버가 실행 중인지 확인하세요.";
  }
  return normalized;
}
