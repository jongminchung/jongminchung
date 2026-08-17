"use client";

import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { useStore } from "zustand";
import {
    createTechUiStore,
    type TechUiState,
    type TechUiStore,
    type ThemeMode,
} from "#lib/tech-ui-store";

export type { TechUiStore } from "#lib/tech-ui-store";

function isThemeMode(value: string | null): value is ThemeMode {
    return value === "light" || value === "dark" || value === "system";
}

function applyTheme(mode: ThemeMode, prefersDark: boolean): void {
    const resolvedMode =
        mode === "system" ? (prefersDark ? "dark" : "light") : mode;
    document.documentElement.dataset.theme = resolvedMode;
    document.documentElement.style.colorScheme = resolvedMode;
}

const TechUiContext = createContext<TechUiStore | null>(null);

/** `TechUiProvider` UI 컴포넌트를 렌더링함 */
export function TechUiProvider({ children }: { readonly children: ReactNode }) {
    const [store] = useState(createTechUiStore);

    useEffect(() => {
        const storedMode = localStorage.getItem("tech-theme");
        if (isThemeMode(storedMode)) store.getState().setThemeMode(storedMode);

        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const syncTheme = (): void =>
            applyTheme(store.getState().themeMode, media.matches);
        syncTheme();

        const unsubscribe = store.subscribe((state, previousState) => {
            if (state.themeMode === previousState.themeMode) return;
            localStorage.setItem("tech-theme", state.themeMode);
            syncTheme();
        });
        const handleMediaChange = (): void => {
            if (store.getState().themeMode === "system") syncTheme();
        };
        media.addEventListener("change", handleMediaChange);

        return () => {
            unsubscribe();
            media.removeEventListener("change", handleMediaChange);
        };
    }, [store]);

    return <TechUiContext value={store}>{children}</TechUiContext>;
}

/** `useTechUiStore` 훅 상태와 제어 함수를 제공함 */
export function useTechUiStore<T>(selector: (state: TechUiState) => T): T {
    const store = use(TechUiContext);
    if (store === null)
        throw new Error("useTechUiStore must be used inside TechUiProvider.");
    return useStore(store, selector);
}
