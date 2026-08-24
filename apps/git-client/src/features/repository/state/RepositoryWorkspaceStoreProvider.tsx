import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useStore } from "zustand";
import {
  createRepositoryWorkspaceStore,
  type RepositoryWorkspaceStore,
  type RepositoryWorkspaceStoreApi,
  type RepositoryWorkspaceStoreOptions,
} from "./repositoryWorkspaceStore";

const RepositoryWorkspaceStoreContext =
  createContext<RepositoryWorkspaceStoreApi | null>(null);

export function RepositoryWorkspaceStoreProvider({
  children,
  ...options
}: RepositoryWorkspaceStoreOptions & { readonly children: ReactNode }) {
  const storeRef = useRef<RepositoryWorkspaceStoreApi | null>(null);
  if (storeRef.current === null)
    storeRef.current = createRepositoryWorkspaceStore(options);
  const store = storeRef.current;

  useEffect(() => () => store.getState().invalidateScope(), [store]);

  return (
    <RepositoryWorkspaceStoreContext.Provider value={store}>
      {children}
    </RepositoryWorkspaceStoreContext.Provider>
  );
}

export function useRepositoryWorkspaceStore<T>(
  selector: (state: RepositoryWorkspaceStore) => T,
): T {
  const store = useContext(RepositoryWorkspaceStoreContext);
  if (store === null) {
    throw new Error(
      "useRepositoryWorkspaceStore must be used inside its provider",
    );
  }
  return useStore(store, selector);
}

export function useRepositoryWorkspaceStoreApi(): RepositoryWorkspaceStoreApi {
  const store = useContext(RepositoryWorkspaceStoreContext);
  if (store === null) {
    throw new Error(
      "useRepositoryWorkspaceStoreApi must be used inside its provider",
    );
  }
  return store;
}
