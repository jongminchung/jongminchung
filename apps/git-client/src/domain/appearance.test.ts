import { describe, expect, it } from "vitest";
import {
  APPEARANCE_STORAGE_KEY,
  AppearanceStorage,
  resolveAppearance,
  storedAppearancePreference,
  synchronizeAppearancePreference,
} from "./appearance";

describe("그게", () => {
  it("[실패] 리베이스된 어두운 모양에 대한 삼삼하고 유효하지 않은 가치가 있다는 것임", () => {
    expect(storedAppearancePreference(null)).toEqual({
      theme: "dark",
      syncWithOs: false,
    });
    expect(storedAppearancePreference("sepia")).toEqual({
      theme: "dark",
      syncWithOs: false,
    });
    expect(storedAppearancePreference("light")).toEqual({
      theme: "light",
      syncWithOs: false,
    });
    expect(storedAppearancePreference("dark")).toEqual({
      theme: "dark",
      syncWithOs: false,
    });
    expect(storedAppearancePreference("system")).toEqual({
      theme: "light",
      syncWithOs: true,
    });
    expect(storedAppearancePreference("darcula")).toEqual({
      theme: "dark",
      syncWithOs: false,
    });
    expect(storedAppearancePreference("highContrast")).toEqual({
      theme: "dark",
      syncWithOs: false,
    });
  });

  it("[성공] 매뉴얼 모드는 현재 상태로 유지하면서 시스템 변경 사항을 해결하는 중임", () => {
    expect(resolveAppearance({ theme: "dark", syncWithOs: true }, false)).toBe(
      "light",
    );
    expect(resolveAppearance({ theme: "light", syncWithOs: true }, true)).toBe(
      "dark",
    );
    expect(resolveAppearance({ theme: "light", syncWithOs: false }, true)).toBe(
      "light",
    );
    expect(resolveAppearance({ theme: "dark", syncWithOs: false }, false)).toBe(
      "dark",
    );
  });

  it("[성공] 키스가 활성화된 동안 현재 시스템 테마를 채택함", () => {
    expect(
      synchronizeAppearancePreference(
        { theme: "dark", syncWithOs: true },
        "light",
      ),
    ).toEqual({
      theme: "light",
      syncWithOs: true,
    });
    expect(
      synchronizeAppearancePreference(
        { theme: "dark", syncWithOs: false },
        "light",
      ),
    ).toEqual({
      theme: "dark",
      syncWithOs: false,
    });
  });

  it("[성공] 가치있는 모드 계약만 유지함", () => {
    const values = new Map<string, string>();
    const storage = AppearanceStorage.of({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
    });

    expect(storage.load()).toEqual({ theme: "dark", syncWithOs: false });
    storage.save({ theme: "dark", syncWithOs: true });
    expect(values.get(APPEARANCE_STORAGE_KEY)).toBe(
      '{"theme":"dark","syncWithOs":true}',
    );
    expect(storage.load()).toEqual({ theme: "dark", syncWithOs: true });
  });
});
