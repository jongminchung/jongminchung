import { createStore, type StoreApi } from "zustand/vanilla";

export interface TechUiState {
  readonly searchOpen: boolean;
  readonly searchHasOpened: boolean;
  readonly openSearch: () => void;
  readonly closeSearch: () => void;
}

export type TechUiStore = StoreApi<TechUiState>;

/** `createTechUiStore` 결과를 생성함 */
export function createTechUiStore(): TechUiStore {
  return createStore<TechUiState>()((set) => ({
    searchOpen: false,
    searchHasOpened: false,
    openSearch: () => set({ searchOpen: true, searchHasOpened: true }),
    closeSearch: () => set({ searchOpen: false }),
  }));
}
