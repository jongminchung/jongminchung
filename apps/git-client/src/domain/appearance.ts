export const APPEARANCE_STORAGE_KEY = "git-client.appearance-mode";

export type AppearanceMode = "system" | "light" | "dark" | "darcula" | "highContrast";
export type ColorScheme = "light" | "dark";

export function isAppearanceMode(value: unknown): value is AppearanceMode {
  return (
    value === "system" ||
    value === "light" ||
    value === "dark" ||
    value === "darcula" ||
    value === "highContrast"
  );
}

export function storedAppearanceMode(value: unknown): AppearanceMode {
  return isAppearanceMode(value) ? value : "dark";
}

export function resolveAppearance(mode: AppearanceMode, systemDark: boolean): ColorScheme {
  if (mode === "system") return systemDark ? "dark" : "light";
  return mode === "light" ? "light" : "dark";
}

export class AppearanceStorage {
  readonly #storage: Pick<Storage, "getItem" | "setItem">;

  private constructor(storage: Pick<Storage, "getItem" | "setItem">) {
    this.#storage = storage;
  }

  static of(storage: Pick<Storage, "getItem" | "setItem">): AppearanceStorage {
    return new AppearanceStorage(storage);
  }

  load(): AppearanceMode {
    try {
      return storedAppearanceMode(this.#storage.getItem(APPEARANCE_STORAGE_KEY));
    } catch {
      return "dark";
    }
  }

  save(mode: AppearanceMode): void {
    try {
      this.#storage.setItem(APPEARANCE_STORAGE_KEY, mode);
    } catch {
      // Appearance remains active for this session when browser storage is unavailable.
    }
  }
}
