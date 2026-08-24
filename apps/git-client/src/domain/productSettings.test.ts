import { describe, expect, it } from "vitest";
import {
  DEFAULT_PRODUCT_SETTINGS,
  parseProductSettings,
} from "./productSettings";

describe("제품 설정", () => {
  it("[성공] 기본적으로 내용을 요약하고 100% 확대/축소를 사용함", () => {
    expect(parseProductSettings(null)).toEqual(DEFAULT_PRODUCT_SETTINGS);
  });

  it("[실패] 새 프로필에 바로 가기 풍선 표시가 없습니다", () => {
    expect(parseProductSettings(null).showShortcutConflictWarning).toBe(false);
    expect(parseProductSettings({}).showShortcutConflictWarning).toBe(false);
  });

  it("[성공] 어색하게 지내는 바로가기 충돌 기본 설정을 유지함", () => {
    expect(
      parseProductSettings({ showShortcutConflictWarning: true }),
    ).toMatchObject({
      showShortcutConflictWarning: true,
    });
    expect(
      parseProductSettings({ showShortcutConflictWarning: false }),
    ).toMatchObject({
      showShortcutConflictWarning: false,
    });
  });

  it("[성공] 지원되는 압축, 확대/축소 및 알림 값에만 권한 부여", () => {
    expect(
      parseProductSettings({
        compactMode: true,
        zoom: 125,
        showNotifications: false,
      }),
    ).toEqual({
      ...DEFAULT_PRODUCT_SETTINGS,
      compactMode: true,
      zoom: 125,
      showNotifications: false,
    });
    expect(
      parseProductSettings({
        compactMode: "yes",
        zoom: 110,
        showNotifications: 1,
      }),
    ).toEqual(DEFAULT_PRODUCT_SETTINGS);
  });

  it("[성공] 환호, 언어 및 지역 가치의 복원", () => {
    expect(
      parseProductSettings({
        editorColorScheme: "dark",
        language: "English",
        region: "asiaExceptChinaMainland",
      }),
    ).toMatchObject({
      editorColorScheme: "dark",
      language: "English",
      region: "asiaExceptChinaMainland",
    });
  });

  it("[성공] 지역적으로 보관된 것을 유지하면서 새 설정을 위치로 기본 설정함", () => {
    expect(parseProductSettings({}).region).toBe("asiaExceptChinaMainland");
    expect(parseProductSettings({ region: "notSpecified" }).region).toBe(
      "notSpecified",
    );
  });

  it("[성공] IDE 크기만 허용함", () => {
    expect(parseProductSettings({ ideFontSize: 16 }).ideFontSize).toBe(16);
    expect(parseProductSettings({ ideFontSize: 4 }).ideFontSize).toBe(13);
    expect(parseProductSettings({ ideFontSize: Number.NaN }).ideFontSize).toBe(
      13,
    );
  });

  it("[성공] 바로가기 재정의 만 유지함", () => {
    expect(
      parseProductSettings({
        keymapOverrides: {
          "view.project": "CmdOrCtrl+1",
          "view.notifications": null,
          tooLong: "x".repeat(129),
        },
      }).keymapOverrides,
    ).toEqual({
      "view.project": "CmdOrCtrl+1",
      "view.notifications": null,
    });
  });
});
