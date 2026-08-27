export type ThemeMode = "light" | "dark" | "system";

export type ThemeSite = "home" | "tech" | "invest";

export const themeStorageKeys: Readonly<Record<ThemeSite, string>> = {
  home: "home-theme",
  tech: "tech-theme",
  invest: "invest-theme",
};

/** `isThemeMode` 값이 저장 가능한 테마인지 확인함 */
export function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark" || value === "system";
}
