import { describe, expect, test } from "vitest";
import { DEFAULT_LOCAL_TRANSLATION_SETTINGS } from "./local-translation";
import {
  checkingTranslationReadinessStatus,
  disabledTranslationReadinessStatus,
  translationReadinessDetail,
  translationReadinessLabel,
  translationReadinessStatusFromSelfTest,
  userVisibleTranslationErrorMessage,
} from "./translation-readiness";

const INTERNAL_USER_VISIBLE_TERMS =
  /provider|MLX|LibreTranslate|browser-detectable|caption cues|script|endpoint|스크립트|브라우저/i;

describe("translation readiness view model", () => {
  test("labels connection states without treating enabled as connected", () => {
    expect(translationReadinessLabel(null)).toBe("번역 연결 확인 중");
    expect(
      translationReadinessLabel(checkingTranslationReadinessStatus(DEFAULT_LOCAL_TRANSLATION_SETTINGS)),
    ).toBe("번역 연결 확인 중");
    expect(
      translationReadinessLabel(disabledTranslationReadinessStatus(DEFAULT_LOCAL_TRANSLATION_SETTINGS)),
    ).toBe("번역 꺼짐");
    expect(
      translationReadinessLabel(
        translationReadinessStatusFromSelfTest(DEFAULT_LOCAL_TRANSLATION_SETTINGS, {
          ok: true,
          message: "Local translation endpoint is ready.",
        }),
      ),
    ).toBe("로컬 번역 연결됨");
    expect(
      translationReadinessLabel(
        translationReadinessStatusFromSelfTest(DEFAULT_LOCAL_TRANSLATION_SETTINGS, {
          ok: false,
          message: "Endpoint returned 403: Forbidden. Check the local service is running.",
        }),
      ),
    ).toBe("번역 연결 실패");
  });

  test("turns wrong-port HTTP failures into actionable Korean copy", () => {
    const detail = translationReadinessDetail(
      translationReadinessStatusFromSelfTest(DEFAULT_LOCAL_TRANSLATION_SETTINGS, {
        ok: false,
        message:
          "Endpoint returned 403: Forbidden. Check the local service is running and supports the selected languages.",
      }),
    );

    expect(detail).toBe(
      "로컬 번역 서버가 HTTP 403 응답을 반환했습니다: Forbidden. 잘못된 포트나 다른 로컬 서비스에 연결됐을 수 있습니다.",
    );
    expect(detail).not.toMatch(INTERNAL_USER_VISIBLE_TERMS);
  });

  test("turns model-server connection failures into actionable Korean copy", () => {
    const detail = translationReadinessDetail(
      translationReadinessStatusFromSelfTest(DEFAULT_LOCAL_TRANSLATION_SETTINGS, {
        ok: false,
        message:
          "Endpoint returned 500: Unable to connect. Is the computer able to access the url?. Check the local service is running and supports the selected languages.",
      }),
    );

    expect(detail).toBe(
      "로컬 번역 서버가 HTTP 500 응답을 반환했습니다: 모델 서버에 연결할 수 없습니다. 로컬 번역 gateway와 모델 서버가 모두 실행 중인지 확인하세요.",
    );
    expect(detail).not.toMatch(INTERNAL_USER_VISIBLE_TERMS);
  });

  test("keeps status errors user-visible but hides implementation terms", () => {
    expect(
      userVisibleTranslationErrorMessage("MLX provider endpoint returned an invalid response."),
    ).toBe(
      "번역 연결 상태를 확인하지 못했습니다. 로컬 번역 gateway 또는 모델 서버가 실행 중인지 확인하세요.",
    );
    expect(userVisibleTranslationErrorMessage("영상 자막 번역에 실패했습니다.")).toBe(
      "영상 자막 번역에 실패했습니다.",
    );
  });
});
