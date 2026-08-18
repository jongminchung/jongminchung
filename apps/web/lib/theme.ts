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

/** `themeScript` 초기 렌더링 전에 색상 모드를 적용함 */
export function themeScript(storageKey: string): string {
    return `(()=>{try{const m=localStorage.getItem(${JSON.stringify(storageKey)})||"system";const d=m==="dark"||m==="light"?m:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=d;document.documentElement.style.colorScheme=d}catch{}})()`;
}
