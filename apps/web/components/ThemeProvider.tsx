"use client";

import {
    createContext,
    type ReactNode,
    use,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { isThemeMode, type ThemeMode } from "#lib/theme";

interface ThemeContextValue {
    readonly mode: ThemeMode;
    readonly setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(mode: ThemeMode, prefersDark: boolean): void {
    const resolvedMode =
        mode === "system" ? (prefersDark ? "dark" : "light") : mode;
    document.documentElement.dataset.theme = resolvedMode;
    document.documentElement.style.colorScheme = resolvedMode;
}

/** `ThemeProvider` 사이트별 테마 선택과 시스템 모드를 동기화함 */
export function ThemeProvider({
    storageKey,
    children,
}: {
    readonly storageKey: string;
    readonly children: ReactNode;
}): React.JSX.Element {
    const [mode, setModeState] = useState<ThemeMode>("system");
    const modeRef = useRef<ThemeMode>("system");

    useEffect(() => {
        const storedMode = localStorage.getItem(storageKey);
        const initialMode = isThemeMode(storedMode) ? storedMode : "system";
        const media = window.matchMedia("(prefers-color-scheme: dark)");

        modeRef.current = initialMode;
        setModeState(initialMode);
        applyTheme(initialMode, media.matches);

        const handleMediaChange = (): void => {
            if (modeRef.current === "system")
                applyTheme("system", media.matches);
        };
        media.addEventListener("change", handleMediaChange);
        return () => media.removeEventListener("change", handleMediaChange);
    }, [storageKey]);

    const setMode = useCallback(
        (nextMode: ThemeMode): void => {
            modeRef.current = nextMode;
            setModeState(nextMode);
            localStorage.setItem(storageKey, nextMode);
            applyTheme(
                nextMode,
                window.matchMedia("(prefers-color-scheme: dark)").matches,
            );
        },
        [storageKey],
    );

    const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
    return <ThemeContext value={value}>{children}</ThemeContext>;
}

/** `useTheme` 공용 테마 상태와 제어 함수를 제공함 */
export function useTheme(): ThemeContextValue {
    const context = use(ThemeContext);
    if (context === null)
        throw new Error("useTheme must be used inside ThemeProvider.");
    return context;
}
