"use client";

import {
    createContext,
    type ReactNode,
    use,
    useCallback,
    useEffect,
    useMemo,
    useSyncExternalStore,
} from "react";
import { isThemeMode, type ThemeMode } from "#lib/theme";

interface ThemeContextValue {
    readonly mode: ThemeMode;
    readonly setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const themeSubscribers = new Map<string, Set<() => void>>();

function applyTheme(mode: ThemeMode, prefersDark: boolean): void {
    const resolvedMode =
        mode === "system" ? (prefersDark ? "dark" : "light") : mode;
    document.documentElement.dataset.theme = resolvedMode;
    document.documentElement.style.colorScheme = resolvedMode;
}

function readThemeMode(storageKey: string): ThemeMode {
    const storedMode = localStorage.getItem(storageKey);
    return isThemeMode(storedMode) ? storedMode : "system";
}

function subscribeThemeMode(
    storageKey: string,
    onStoreChange: () => void,
): () => void {
    const subscribers = themeSubscribers.get(storageKey) ?? new Set();
    subscribers.add(onStoreChange);
    themeSubscribers.set(storageKey, subscribers);

    const handleStorage = (event: StorageEvent): void => {
        if (event.key === storageKey) onStoreChange();
    };
    window.addEventListener("storage", handleStorage);

    return () => {
        subscribers.delete(onStoreChange);
        if (subscribers.size === 0) themeSubscribers.delete(storageKey);
        window.removeEventListener("storage", handleStorage);
    };
}

function writeThemeMode(storageKey: string, mode: ThemeMode): void {
    localStorage.setItem(storageKey, mode);
    themeSubscribers.get(storageKey)?.forEach((subscriber) => subscriber());
}

/** `ThemeProvider` 사이트별 테마 선택과 시스템 모드를 동기화함 */
export function ThemeProvider({
    storageKey,
    children,
}: {
    readonly storageKey: string;
    readonly children: ReactNode;
}): React.JSX.Element {
    const subscribe = useCallback(
        (onStoreChange: () => void) =>
            subscribeThemeMode(storageKey, onStoreChange),
        [storageKey],
    );
    const getSnapshot = useCallback(
        () => readThemeMode(storageKey),
        [storageKey],
    );
    const mode = useSyncExternalStore<ThemeMode>(
        subscribe,
        getSnapshot,
        () => "system",
    );

    useEffect(() => {
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        applyTheme(mode, media.matches);

        const handleMediaChange = (): void => {
            if (mode === "system") applyTheme(mode, media.matches);
        };
        media.addEventListener("change", handleMediaChange);
        return () => media.removeEventListener("change", handleMediaChange);
    }, [mode]);

    const setMode = useCallback(
        (nextMode: ThemeMode): void => {
            applyTheme(
                nextMode,
                window.matchMedia("(prefers-color-scheme: dark)").matches,
            );
            writeThemeMode(storageKey, nextMode);
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
