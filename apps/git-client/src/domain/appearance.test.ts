import { describe, expect, it } from "vitest";
import {
  APPEARANCE_STORAGE_KEY,
  AppearanceStorage,
  resolveAppearance,
  storedAppearanceMode,
} from "./appearance";

describe("appearance", () => {
  it("defaults missing and invalid persisted values to the Rebased dark baseline", () => {
    expect(storedAppearanceMode(null)).toBe("dark");
    expect(storedAppearanceMode("sepia")).toBe("dark");
    expect(storedAppearanceMode("light")).toBe("light");
    expect(storedAppearanceMode("dark")).toBe("dark");
  });

  it("resolves system changes while manual modes remain fixed", () => {
    expect(resolveAppearance("system", false)).toBe("light");
    expect(resolveAppearance("system", true)).toBe("dark");
    expect(resolveAppearance("light", true)).toBe("light");
    expect(resolveAppearance("dark", false)).toBe("dark");
  });

  it("persists only the validated mode contract", () => {
    const values = new Map<string, string>();
    const storage = AppearanceStorage.of({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
    });

    expect(storage.load()).toBe("dark");
    storage.save("dark");
    expect(values.get(APPEARANCE_STORAGE_KEY)).toBe("dark");
    expect(storage.load()).toBe("dark");
  });
});
