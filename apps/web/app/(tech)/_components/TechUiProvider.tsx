"use client";

import { createContext, type ReactNode, use, useState } from "react";
import { useStore } from "zustand";
import {
  createTechUiStore,
  type TechUiState,
  type TechUiStore,
} from "#lib/tech/ui-store";

export type { TechUiStore } from "#lib/tech/ui-store";

const TechUiContext = createContext<TechUiStore | null>(null);

/** `TechUiProvider` Tech 검색 UI 상태를 제공함 */
export function TechUiProvider({ children }: { readonly children: ReactNode }) {
  const [store] = useState(createTechUiStore);

  return <TechUiContext value={store}>{children}</TechUiContext>;
}

/** `useTechUiStore` 훅 상태와 제어 함수를 제공함 */
export function useTechUiStore<T>(selector: (state: TechUiState) => T): T {
  const store = use(TechUiContext);
  if (store === null)
    throw new Error("useTechUiStore must be used inside TechUiProvider.");
  return useStore(store, selector);
}
