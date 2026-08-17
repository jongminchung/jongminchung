import { createStore, type StoreApi } from "zustand/vanilla";

export type ThemeMode = "light" | "dark" | "system";

export interface TechUiState {
    readonly themeMode: ThemeMode;
    readonly searchOpen: boolean;
    readonly searchHasOpened: boolean;
    readonly setThemeMode: (mode: ThemeMode) => void;
    readonly openSearch: () => void;
    readonly closeSearch: () => void;
}

export type TechUiStore = StoreApi<TechUiState>;

export function createTechUiStore(): TechUiStore {
    return createStore<TechUiState>()((set) => ({
        themeMode: "system",
        searchOpen: false,
        searchHasOpened: false,
        setThemeMode: (themeMode) => set({ themeMode }),
        openSearch: () => set({ searchOpen: true, searchHasOpened: true }),
        closeSearch: () => set({ searchOpen: false }),
    }));
}
