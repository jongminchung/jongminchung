import { createContext, useContext, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { createGitBridge } from "../bridge/createGitBridge";
import type { GitBridge } from "../bridge/GitBridge";
import {
  createGitSessionStore,
  type GitSessionStore,
  type GitSessionStoreApi,
} from "./gitSessionStore";
import { createInitialWorkspaceState } from "./sessionBootstrap";

const GitSessionStoreContext = createContext<GitSessionStoreApi | null>(null);

export function GitSessionStoreProvider({
  bridge,
  children,
}: {
  readonly bridge?: GitBridge;
  readonly children: ReactNode;
}) {
  const storeRef = useRef<GitSessionStoreApi | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createGitSessionStore({
      bridge: bridge ?? createGitBridge(),
      initialWorkspace: createInitialWorkspaceState(),
    });
  }
  return (
    <GitSessionStoreContext.Provider value={storeRef.current}>
      {children}
    </GitSessionStoreContext.Provider>
  );
}

export function useGitSessionStore<T>(selector: (state: GitSessionStore) => T): T {
  const store = useContext(GitSessionStoreContext);
  if (store === null) throw new Error("useGitSessionStore must be used inside its provider");
  return useStore(store, selector);
}

export const useGitSessionSelector = useGitSessionStore;

export function useGitSessionActions() {
  return useGitSessionStore(
    useShallow((store) => ({
      beginMutation: store.beginMutation,
      configureRefreshCoordinator: store.configureRefreshCoordinator,
      finishMutation: store.finishMutation,
      markRecoveryUpdated: store.markRecoveryUpdated,
      resetSession: store.resetSession,
      setActivity: store.setActivity,
      setConsoleEntries: store.setConsoleEntries,
      setWorkspace: store.setWorkspace,
    })),
  );
}

export function useGitSessionStoreApi(): GitSessionStoreApi {
  const store = useContext(GitSessionStoreContext);
  if (store === null) throw new Error("useGitSessionStoreApi must be used inside its provider");
  return store;
}
