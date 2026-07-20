export const APPEARANCE_STORAGE_KEY = "git-client.appearance-mode";

export type AppearanceTheme = "light" | "dark";
export type ColorScheme = AppearanceTheme;

export interface AppearancePreference {
  readonly theme: AppearanceTheme;
  readonly syncWithOs: boolean;
}

export const DEFAULT_APPEARANCE_PREFERENCE: AppearancePreference = {
  theme: "light",
  syncWithOs: false,
};

export function isAppearanceTheme(value: unknown): value is AppearanceTheme {
  return value === "light" || value === "dark";
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function storedAppearancePreference(value: unknown): AppearancePreference {
  if (value === "light" || value === "dark") {
    return { theme: value, syncWithOs: false };
  }
  if (value === "system") return { theme: "light", syncWithOs: true };
  if (value === "darcula" || value === "highContrast") {
    return { theme: "dark", syncWithOs: false };
  }
  if (isRecord(value) && isAppearanceTheme(value.theme) && typeof value.syncWithOs === "boolean") {
    return { theme: value.theme, syncWithOs: value.syncWithOs };
  }
  return DEFAULT_APPEARANCE_PREFERENCE;
}

export function resolveAppearance(
  preference: AppearancePreference,
  systemDark: boolean,
): ColorScheme {
  return preference.syncWithOs ? (systemDark ? "dark" : "light") : preference.theme;
}

export function synchronizeAppearancePreference(
  preference: AppearancePreference,
  systemTheme: AppearanceTheme,
): AppearancePreference {
  if (!preference.syncWithOs || preference.theme === systemTheme) return preference;
  return { theme: systemTheme, syncWithOs: true };
}

function parseStoredPreference(value: string | null): AppearancePreference {
  if (value === null) return DEFAULT_APPEARANCE_PREFERENCE;
  try {
    return storedAppearancePreference(JSON.parse(value));
  } catch {
    return storedAppearancePreference(value);
  }
}

export class AppearanceStorage {
  readonly #storage: Pick<Storage, "getItem" | "setItem">;

  private constructor(storage: Pick<Storage, "getItem" | "setItem">) {
    this.#storage = storage;
  }

  static of(storage: Pick<Storage, "getItem" | "setItem">): AppearanceStorage {
    return new AppearanceStorage(storage);
  }

  load(): AppearancePreference {
    try {
      return parseStoredPreference(this.#storage.getItem(APPEARANCE_STORAGE_KEY));
    } catch {
      return DEFAULT_APPEARANCE_PREFERENCE;
    }
  }

  save(preference: AppearancePreference): void {
    try {
      this.#storage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(preference));
    } catch {
      // Appearance remains active for this session when browser storage is unavailable.
    }
  }
}
