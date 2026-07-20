import { describe, expect, it } from "vitest";
import {
  APPEARANCE_STORAGE_KEY,
  AppearanceStorage,
  resolveAppearance,
  storedAppearancePreference,
  synchronizeAppearancePreference,
} from "./appearance";

describe("appearance", () => {
  it("defaults fresh and invalid persisted values to Islands Light", () => {
    expect(storedAppearancePreference(null)).toEqual({ theme: "light", syncWithOs: false });
    expect(storedAppearancePreference("sepia")).toEqual({ theme: "light", syncWithOs: false });
    expect(storedAppearancePreference("light")).toEqual({ theme: "light", syncWithOs: false });
    expect(storedAppearancePreference("dark")).toEqual({ theme: "dark", syncWithOs: false });
    expect(storedAppearancePreference("system")).toEqual({ theme: "light", syncWithOs: true });
    expect(storedAppearancePreference("darcula")).toEqual({ theme: "dark", syncWithOs: false });
    expect(storedAppearancePreference("highContrast")).toEqual({
      theme: "dark",
      syncWithOs: false,
    });
  });

  it("resolves system changes while manual modes remain fixed", () => {
    expect(resolveAppearance({ theme: "dark", syncWithOs: true }, false)).toBe("light");
    expect(resolveAppearance({ theme: "light", syncWithOs: true }, true)).toBe("dark");
    expect(resolveAppearance({ theme: "light", syncWithOs: false }, true)).toBe("light");
    expect(resolveAppearance({ theme: "dark", syncWithOs: false }, false)).toBe("dark");
  });

  it("adopts the current system theme while synchronization is enabled", () => {
    expect(synchronizeAppearancePreference({ theme: "dark", syncWithOs: true }, "light")).toEqual({
      theme: "light",
      syncWithOs: true,
    });
    expect(synchronizeAppearancePreference({ theme: "dark", syncWithOs: false }, "light")).toEqual({
      theme: "dark",
      syncWithOs: false,
    });
  });

  it("persists only the validated mode contract", () => {
    const values = new Map<string, string>();
    const storage = AppearanceStorage.of({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
    });

    expect(storage.load()).toEqual({ theme: "light", syncWithOs: false });
    storage.save({ theme: "dark", syncWithOs: true });
    expect(values.get(APPEARANCE_STORAGE_KEY)).toBe('{"theme":"dark","syncWithOs":true}');
    expect(storage.load()).toEqual({ theme: "dark", syncWithOs: true });
  });
});
