import { useCallback, useEffect, useRef, useState } from "react";
import { isBottomPanelTab } from "./BottomPanelTabs";
import type { BottomPanelTab } from "./bottomPanelTypes";

export function useBottomPanelLifecycle({
  active,
  collapsed,
  onActiveChange,
  onShelveChanges,
  onStashChanges,
  onToggle,
  recoveryCount,
  shelfCount,
  stashCount,
}: {
  readonly active: BottomPanelTab;
  readonly collapsed: boolean;
  readonly onActiveChange: (active: BottomPanelTab) => void;
  readonly onShelveChanges: () => Promise<void>;
  readonly onStashChanges: () => Promise<void>;
  readonly onToggle: () => void;
  readonly recoveryCount: number;
  readonly shelfCount: number;
  readonly stashCount: number;
}) {
  const [explicitlyOpened, setExplicitlyOpened] = useState(false);
  const [localHistoryPath, setLocalHistoryPath] = useState<string>();
  const panelRef = useRef<HTMLElement>(null);
  const originFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const rememberExternalFocus = (event: FocusEvent): void => {
      if (!(event.target instanceof HTMLElement)) return;
      if (panelRef.current?.contains(event.target)) return;
      originFocusRef.current = event.target;
    };
    window.addEventListener("focusin", rememberExternalFocus);
    return () => window.removeEventListener("focusin", rememberExternalFocus);
  }, []);

  const explicitlyOpen = useCallback((): void => {
    setExplicitlyOpened(true);
    if (collapsed) onToggle();
  }, [collapsed, onToggle]);

  const hidePanel = useCallback((): void => {
    if (collapsed) return;
    onToggle();
    const target = originFocusRef.current;
    window.requestAnimationFrame(() => {
      if (target?.isConnected) target.focus();
    });
  }, [collapsed, onToggle]);

  useEffect(() => {
    const openTerminal = (): void => {
      onActiveChange("terminal");
      explicitlyOpen();
      window.requestAnimationFrame(() => {
        const terminalInput = document.querySelector<HTMLElement>(
          '[data-command-scope="terminal"] textarea, [data-command-scope="terminal"] [contenteditable="true"], [data-command-scope="terminal"]',
        );
        terminalInput?.focus();
      });
    };
    window.addEventListener("git-client:open-terminal", openTerminal);
    return () => window.removeEventListener("git-client:open-terminal", openTerminal);
  }, [explicitlyOpen, onActiveChange]);

  useEffect(() => {
    const openLocalHistory = (event: Event): void => {
      const path =
        event instanceof CustomEvent && typeof event.detail?.path === "string"
          ? event.detail.path
          : undefined;
      setLocalHistoryPath(path);
      onActiveChange("localHistory");
      explicitlyOpen();
    };
    window.addEventListener("git-client:open-local-history", openLocalHistory);
    return () => window.removeEventListener("git-client:open-local-history", openLocalHistory);
  }, [explicitlyOpen, onActiveChange]);

  useEffect(() => {
    const openGitConsole = (): void => {
      onActiveChange("gitConsole");
      explicitlyOpen();
      window.requestAnimationFrame(() => {
        panelRef.current?.querySelector<HTMLElement>('[aria-label="Git Console"]')?.focus();
      });
    };
    window.addEventListener("git-client:open-git-console", openGitConsole);
    return () => window.removeEventListener("git-client:open-git-console", openGitConsole);
  }, [explicitlyOpen, onActiveChange]);

  useEffect(() => {
    const openPanel = (event: Event): void => {
      const requested = event instanceof CustomEvent ? event.detail?.tab : undefined;
      if (!isBottomPanelTab(requested)) return;
      onActiveChange(requested);
      explicitlyOpen();
    };
    window.addEventListener("git-client:open-bottom-panel", openPanel);
    return () => window.removeEventListener("git-client:open-bottom-panel", openPanel);
  }, [explicitlyOpen, onActiveChange]);

  useEffect(() => {
    const openStashDialog = (): void => {
      onActiveChange("stash");
      explicitlyOpen();
      void onStashChanges();
    };
    window.addEventListener("git-client:stash-changes", openStashDialog);
    return () => window.removeEventListener("git-client:stash-changes", openStashDialog);
  }, [explicitlyOpen, onActiveChange, onStashChanges]);

  useEffect(() => {
    const openShelfDialog = (): void => {
      onActiveChange("shelf");
      explicitlyOpen();
      void onShelveChanges();
    };
    window.addEventListener("git-client:shelve-changes", openShelfDialog);
    return () => window.removeEventListener("git-client:shelve-changes", openShelfDialog);
  }, [explicitlyOpen, onActiveChange, onShelveChanges]);

  useEffect(() => {
    const activeIsEmpty =
      (active === "shelf" && shelfCount === 0) ||
      (active === "stash" && stashCount === 0) ||
      (active === "recovery" && recoveryCount === 0);
    if (!collapsed && !explicitlyOpened && activeIsEmpty) onToggle();
  }, [active, collapsed, explicitlyOpened, onToggle, recoveryCount, shelfCount, stashCount]);

  return { explicitlyOpen, hidePanel, localHistoryPath, panelRef };
}
