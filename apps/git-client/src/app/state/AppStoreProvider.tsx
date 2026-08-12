import { createContext, useContext, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import { createAppStore, type AppStore, type AppStoreApi } from "./appStore";

const AppStoreContext = createContext<AppStoreApi | null>(null);

export function AppStoreProvider({
    children,
}: {
    readonly children: ReactNode;
}) {
    const storeRef = useRef<AppStoreApi | null>(null);
    if (storeRef.current === null) storeRef.current = createAppStore();
    return (
        <AppStoreContext.Provider value={storeRef.current}>
            {children}
        </AppStoreContext.Provider>
    );
}

export function useAppStore<T>(selector: (state: AppStore) => T): T {
    const store = useContext(AppStoreContext);
    if (store === null)
        throw new Error("useAppStore must be used inside AppStoreProvider");
    return useStore(store, selector);
}

export function useAppStoreApi(): AppStoreApi {
    const store = useContext(AppStoreContext);
    if (store === null)
        throw new Error("useAppStoreApi must be used inside AppStoreProvider");
    return store;
}
